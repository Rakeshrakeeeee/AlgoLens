import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("trace.py")
SPEC = importlib.util.spec_from_file_location("algolens_trace", MODULE_PATH)
trace_module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(trace_module)


class TraceRunnerTests(unittest.TestCase):
    def test_captures_source_lines_locals_and_return_value(self):
        response = trace_module.run({
            "source": "class Solution:\n    def solve(self, nums):\n        total = sum(nums)\n        return [total]\n",
            "method": "solve",
            "arguments": [[2, 3]],
        })

        self.assertEqual(response["status"], "ok")
        self.assertEqual(response["result"]["value"], {"$ref": "@1"})
        self.assertTrue(any(event["kind"] == "line" and event["line"] == 3 for event in response["events"]))
        self.assertTrue(any(event["locals"].get("total") == 5 for event in response["events"]))

    def test_captures_runtime_error_line(self):
        response = trace_module.run({
            "source": "class Solution:\n    def solve(self, nums):\n        return nums[8]\n",
            "method": "solve",
            "arguments": [[1]],
        })

        self.assertEqual(response["status"], "error")
        self.assertEqual(response["error"]["type"], "IndexError")
        self.assertEqual(response["error"]["line"], 3)
        self.assertTrue(response["events"])

    def test_rejects_imports_that_enable_network_or_process_access(self):
        response = trace_module.run({
            "source": "class Solution:\n    def solve(self):\n        import socket\n        return True\n",
            "method": "solve",
            "arguments": [],
        })

        self.assertEqual(response["status"], "error")
        self.assertEqual(response["error"]["type"], "ImportError")

    def test_rejects_deep_or_non_json_arguments_before_execution(self):
        nested = 0
        for _ in range(13):
            nested = [nested]
        response = trace_module.run({
            "source": "raise RuntimeError('must not run')",
            "method": "solve",
            "arguments": [nested],
        })

        self.assertEqual(response["status"], "invalid_request")

    def test_reports_trace_truncation_instead_of_claiming_completeness(self):
        response = trace_module.run({
            "source": "class Solution:\n    def solve(self):\n        for value in range(1500):\n            pass\n        return True\n",
            "method": "solve",
            "arguments": [],
        })

        self.assertEqual(response["status"], "ok")
        self.assertTrue(response["truncated"])
        self.assertLessEqual(len(response["events"]), trace_module.MAX_EVENTS)

    def test_caps_captured_program_output(self):
        stream = trace_module.CappedTextStream(4)
        stream.write("hello world")

        self.assertTrue(stream.truncated)
        self.assertEqual(stream.getvalue(), "hell\n[output truncated]")


if __name__ == "__main__":
    unittest.main()
