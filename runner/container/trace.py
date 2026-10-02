import contextlib
import io
import json
import math
import re
import sys
import traceback
import types


MAX_EVENTS = 1_000
MAX_TRACE_BYTES = 4 * 1024 * 1024
MAX_HEAP_NODES = 128
MAX_ITEMS_PER_NODE = 64
MAX_STRING_LENGTH = 256
MAX_OUTPUT_LENGTH = 65_536
BLOCKED_IMPORTS = {"ctypes", "importlib", "inspect", "multiprocessing", "socket", "subprocess", "sys"}


class CappedTextStream(io.TextIOBase):
    def __init__(self, maximum):
        self.maximum = maximum
        self.parts = []
        self.length = 0
        self.truncated = False

    def write(self, text):
        if not isinstance(text, str):
            raise TypeError("write() argument must be str")
        remaining = self.maximum - self.length
        if remaining > 0:
            accepted = text[:remaining]
            self.parts.append(accepted)
            self.length += len(accepted)
        if len(text) > remaining:
            self.truncated = True
        return len(text)

    def getvalue(self):
        value = "".join(self.parts)
        return value + ("\n[output truncated]" if self.truncated else "")


class SnapshotBuilder:
    def __init__(self):
        self.nodes = []
        self.ids = {}

    def encode(self, value, depth=0):
        value_type = type(value)
        if value is None or value_type is bool:
            return value
        if value_type is int:
            return value if value.bit_length() <= 1_024 else f"<integer: {value.bit_length()} bits>"
        if value_type is float:
            return value if math.isfinite(value) else "<non-finite number>"
        if value_type is str:
            return value if len(value) <= MAX_STRING_LENGTH else value[:MAX_STRING_LENGTH] + "…"
        if value_type not in (list, tuple, dict, set):
            return {"type": value_type.__name__, "summary": "<instance>"}

        object_key = id(value)
        if object_key in self.ids:
            return {"$ref": self.ids[object_key]}
        if depth >= 4 or len(self.nodes) >= MAX_HEAP_NODES:
            return {"type": value_type.__name__, "summary": "<snapshot limit>"}

        object_id = f"@{len(self.nodes) + 1}"
        self.ids[object_key] = object_id
        node = {"id": object_id, "type": value_type.__name__}
        self.nodes.append(node)

        if value_type in (list, tuple, set):
            node["kind"] = "sequence"
            items = list(value) if value_type is set else value
            node["items"] = [self.encode(item, depth + 1) for item in items[:MAX_ITEMS_PER_NODE]]
            if len(items) > MAX_ITEMS_PER_NODE:
                node["truncated"] = True
        else:
            node["kind"] = "mapping"
            entries = []
            for index, (key, item) in enumerate(value.items()):
                if index >= MAX_ITEMS_PER_NODE:
                    node["truncated"] = True
                    break
                safe_key = self.encode(key, depth + 1)
                entries.append([safe_key, self.encode(item, depth + 1)])
            node["entries"] = entries
        return {"$ref": object_id}


def _blocked_import(name, globals_=None, locals_=None, fromlist=(), level=0):
    if name.split(".", 1)[0] in BLOCKED_IMPORTS:
        raise ImportError(f"Import '{name}' is disabled in AlgoLens execution mode.")
    return __import__(name, globals_, locals_, fromlist, level)


def _result_value(value):
    builder = SnapshotBuilder()
    encoded = builder.encode(value)
    return {"value": encoded, "heap": builder.nodes}


def _valid_argument(value, depth=0):
    value_type = type(value)
    if value is None or value_type in (bool, int):
        return value_type is not int or value.bit_length() <= 1_024
    if value_type is float:
        return math.isfinite(value)
    if value_type is str:
        return len(value) <= 2_000
    if depth >= 12:
        return False
    if value_type is list:
        return len(value) <= 256 and all(_valid_argument(item, depth + 1) for item in value)
    if value_type is dict:
        return len(value) <= 128 and all(
            type(key) is str and len(key) <= 128 and _valid_argument(item, depth + 1)
            for key, item in value.items()
        )
    return False


def _error_line(error):
    if type(error) is SyntaxError:
        return error.lineno
    traceback_object = error.__traceback__
    source_line = None
    while traceback_object is not None:
        if traceback_object.tb_frame.f_code.co_filename == "<algolens-user>":
            source_line = traceback_object.tb_lineno
        traceback_object = traceback_object.tb_next
    return source_line


def run(request):
    source = request.get("source")
    method = request.get("method")
    arguments = request.get("arguments")
    if not isinstance(source, str) or len(source) > 12_000:
        return {"status": "invalid_request", "error": "Source must be a string of at most 12,000 characters."}
    if not isinstance(method, str) or not re.fullmatch(r"[A-Za-z_]\w{0,79}", method):
        return {"status": "invalid_request", "error": "Enter a valid method or function name."}
    if not isinstance(arguments, list) or len(arguments) > 32:
        return {"status": "invalid_request", "error": "Arguments must be a JSON array with at most 32 items."}
    if not all(_valid_argument(argument) for argument in arguments):
        return {"status": "invalid_request", "error": "Arguments may use bounded JSON values, arrays, and objects only."}

    events = []
    trace_bytes = 0
    truncated = False
    next_frame_id = 1
    frame_ids = {}
    frame_parents = {}

    def capture(frame, event_name, event_argument):
        nonlocal trace_bytes, truncated, next_frame_id
        if frame.f_code.co_filename != "<algolens-user>" or truncated:
            return capture

        frame_key = id(frame)
        if event_name == "call":
            frame_id = next_frame_id
            next_frame_id += 1
            parent = frame.f_back
            frame_ids[frame_key] = frame_id
            frame_parents[frame_key] = frame_ids.get(id(parent)) if parent else None
        else:
            frame_id = frame_ids.get(frame_key, 0)

        kind = {"call": "call", "line": "line", "return": "return", "exception": "exception"}.get(event_name)
        if kind is None:
            return capture

        builder = SnapshotBuilder()
        locals_snapshot = {}
        for index, (name, value) in enumerate(frame.f_locals.items()):
            if index >= 64:
                locals_snapshot["…"] = "<local limit>"
                break
            locals_snapshot[name] = builder.encode(value)
        event = {
            "sequence": len(events),
            "kind": kind,
            "line": max(1, frame.f_lineno),
            "function": frame.f_code.co_name,
            "frameId": frame_id,
            "parentFrameId": frame_parents.get(frame_key),
            "locals": locals_snapshot,
            "heap": builder.nodes,
        }
        encoded_size = len(json.dumps(event, ensure_ascii=True, separators=(",", ":")))
        if len(events) >= MAX_EVENTS or trace_bytes + encoded_size > MAX_TRACE_BYTES:
            truncated = True
            return capture
        events.append(event)
        trace_bytes += encoded_size
        if kind in ("return", "exception"):
            frame_ids.pop(frame_key, None)
            frame_parents.pop(frame_key, None)
        return capture

    output_buffer = CappedTextStream(MAX_OUTPUT_LENGTH)
    errors_buffer = CappedTextStream(MAX_OUTPUT_LENGTH)
    safe_builtins = dict(vars(__builtins__) if isinstance(__builtins__, types.ModuleType) else __builtins__)
    safe_builtins["__import__"] = _blocked_import
    namespace = {"__name__": "__algolens_user__", "__builtins__": safe_builtins}

    try:
        compiled = compile(source, "<algolens-user>", "exec")
        with contextlib.redirect_stdout(output_buffer), contextlib.redirect_stderr(errors_buffer):
            sys.settrace(capture)
            try:
                exec(compiled, namespace, namespace)
                owner = namespace.get("Solution")
                if isinstance(owner, type):
                    instance = owner()
                    function = getattr(instance, method, None)
                else:
                    function = namespace.get(method)
                if not callable(function):
                    raise LookupError(f"No callable entry point named '{method}' was found.")
                result = function(*arguments)
            finally:
                sys.settrace(None)
        return {
            "status": "ok",
            "events": events,
            "result": _result_value(result),
            "stdout": output_buffer.getvalue()[:65_536],
            "outputTruncated": output_buffer.truncated or errors_buffer.truncated,
            "truncated": truncated,
        }
    except BaseException as error:
        error_type = type(error).__name__
        if type(error) in (SyntaxError, ImportError, LookupError, TypeError, ValueError, IndexError, KeyError, ZeroDivisionError, NameError, AttributeError):
            args = BaseException.args.__get__(error, type(error))
            message = args[0] if args and type(args[0]) is str else error_type
        else:
            message = error_type
        return {
            "status": "error",
            "error": {"type": error_type, "message": message[:300], "line": _error_line(error)},
            "events": events,
            "stdout": output_buffer.getvalue()[:65_536],
            "outputTruncated": output_buffer.truncated or errors_buffer.truncated,
            "truncated": truncated,
        }


def main():
    try:
        request = json.load(sys.stdin)
        response = run(request)
    except BaseException as error:
        response = {
            "status": "runner_error",
            "error": {"type": type(error).__name__, "message": "The sandbox could not create a trace."},
        }
    sys.stdout.write(json.dumps(response, ensure_ascii=True, separators=(",", ":")))


if __name__ == "__main__":
    main()
