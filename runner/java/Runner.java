import com.sun.jdi.AbsentInformationException;
import com.sun.jdi.ArrayReference;
import com.sun.jdi.BooleanValue;
import com.sun.jdi.ByteValue;
import com.sun.jdi.CharValue;
import com.sun.jdi.DoubleValue;
import com.sun.jdi.FloatValue;
import com.sun.jdi.IntegerValue;
import com.sun.jdi.LongValue;
import com.sun.jdi.ObjectReference;
import com.sun.jdi.PrimitiveValue;
import com.sun.jdi.ShortValue;
import com.sun.jdi.StringReference;
import com.sun.jdi.ThreadReference;
import com.sun.jdi.Value;
import com.sun.jdi.VirtualMachine;
import com.sun.jdi.VirtualMachineManager;
import com.sun.jdi.connect.Connector;
import com.sun.jdi.connect.LaunchingConnector;
import com.sun.jdi.event.ClassPrepareEvent;
import com.sun.jdi.event.Event;
import com.sun.jdi.event.EventIterator;
import com.sun.jdi.event.EventQueue;
import com.sun.jdi.event.EventSet;
import com.sun.jdi.event.ExceptionEvent;
import com.sun.jdi.event.StepEvent;
import com.sun.jdi.event.VMDeathEvent;
import com.sun.jdi.event.VMDisconnectEvent;
import com.sun.jdi.request.ClassPrepareRequest;
import com.sun.jdi.request.EventRequest;
import com.sun.jdi.request.ExceptionRequest;
import com.sun.jdi.request.StepRequest;
import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaCompiler;
import javax.tools.JavaFileObject;
import javax.tools.ToolProvider;
import java.lang.reflect.Array;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

public final class Runner {
    private static final int MAX_EVENTS = 1_000;
    private static final int MAX_TRACE_BYTES = 4 * 1024 * 1024;
    private static final int MAX_OUTPUT_BYTES = 65_536;
    private static final int MAX_HEAP_NODES = 128;
    private static final int MAX_ITEMS = 64;

    private final List<Map<String, Object>> events = new ArrayList<>();
    private long traceBytes;
    private boolean truncated;
    private boolean outputTruncated;

    public static void main(String[] arguments) {
        try {
            String requestText = new String(System.in.readAllBytes(), StandardCharsets.UTF_8);
            Object parsed = Json.parse(requestText);
            if (!(parsed instanceof Map<?, ?> map)) throw new IllegalArgumentException("Request must be a JSON object.");
            System.out.print(Json.stringify(new Runner().run(castMap(map))));
        } catch (Throwable error) {
            String message = error.getMessage();
            if (message == null || message.isBlank()) message = "The isolated Java runner could not create a trace.";
            System.out.print(Json.stringify(errorResponse(error.getClass().getSimpleName(), message.substring(0, Math.min(300, message.length())), null)));
        }
    }

    private Map<String, Object> run(Map<String, Object> request) throws Exception {
        Object sourceValue = request.get("source");
        Object methodValue = request.get("method");
        Object argsValue = request.get("arguments");
        if (!(sourceValue instanceof String source) || source.length() > 12_000) {
            return invalid("Source must be a string of at most 12,000 characters.");
        }
        if (!(methodValue instanceof String method) || !method.matches("[A-Za-z_$][A-Za-z0-9_$]{0,79}")) {
            return invalid("Enter a valid Java method name.");
        }
        if (!(argsValue instanceof List<?> args) || args.size() > 32) {
            return invalid("Arguments must be a JSON array with at most 32 items.");
        }

        Path directory = Files.createTempDirectory(Path.of("/tmp"), "algolens-java-");
        VirtualMachine vm = null;
        Process process = null;
        try {
            Path sourceFile = directory.resolve("Solution.java");
            Files.writeString(sourceFile, source, StandardCharsets.UTF_8);
            List<Map<String, Object>> diagnostics = compile(sourceFile, directory);
            if (!diagnostics.isEmpty()) {
                Map<String, Object> response = errorResponse("CompileError", "Java compilation failed.", firstLine(diagnostics));
                response.put("diagnostics", diagnostics);
                return response;
            }

            LaunchingConnector connector = defaultConnector();
            Map<String, Connector.Argument> connectorArguments = connector.defaultArguments();
            connectorArguments.get("main").setValue("Harness " + method + " " + Base64.getEncoder().encodeToString(Json.stringify(args).getBytes(StandardCharsets.UTF_8)));
            connectorArguments.get("options").setValue("-cp " + directory + ":/runner");
            connectorArguments.get("suspend").setValue("true");
            vm = connector.launch(connectorArguments);
            process = vm.process();
            ThreadReference debugThread = vm.allThreads().stream().filter(thread -> thread.name().equals("main")).findFirst().orElse(null);
            if (debugThread == null) throw new IllegalStateException("Could not attach to the Java execution thread.");

            ClassPrepareRequest prepare = vm.eventRequestManager().createClassPrepareRequest();
            prepare.addClassFilter("Solution");
            prepare.setSuspendPolicy(EventRequest.SUSPEND_EVENT_THREAD);
            prepare.enable();
            ExceptionRequest exceptions = vm.eventRequestManager().createExceptionRequest(null, true, true);
            exceptions.setSuspendPolicy(EventRequest.SUSPEND_EVENT_THREAD);
            exceptions.enable();
            vm.resume();

            EventQueue queue = vm.eventQueue();
            boolean completed = false;
            StepRequest activeStep = null;
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(8);
            while (!completed && System.nanoTime() < deadline) {
                EventSet set = queue.remove(100);
                if (set == null) continue;
                boolean enableStep = false;
                try {
                    EventIterator iterator = set.eventIterator();
                    while (iterator.hasNext()) {
                        Event event = iterator.nextEvent();
                        if (event instanceof ClassPrepareEvent prepared && prepared.referenceType().name().equals("Solution")) {
                            enableStep = true;
                            debugThread = prepared.thread();
                        } else if (event instanceof StepEvent step) {
                            capture(step.thread(), step.location().lineNumber(), "line");
                            if (activeStep != null) {
                                vm.eventRequestManager().deleteEventRequest(activeStep);
                                activeStep = null;
                            }
                            enableStep = true;
                            debugThread = step.thread();
                        } else if (event instanceof ExceptionEvent exception) {
                            if (exception.location().declaringType().name().equals("Solution")) {
                                capture(exception.thread(), exception.location().lineNumber(), "exception");
                            }
                        } else if (event instanceof VMDeathEvent || event instanceof VMDisconnectEvent) {
                            completed = true;
                        }
                    }
                    if (enableStep && debugThread != null && !truncated) {
                        activeStep = vm.eventRequestManager().createStepRequest(debugThread, StepRequest.STEP_LINE, StepRequest.STEP_INTO);
                        activeStep.addClassFilter("Solution");
                        activeStep.addCountFilter(1);
                        activeStep.setSuspendPolicy(EventRequest.SUSPEND_EVENT_THREAD);
                        activeStep.enable();
                    }
                } finally {
                    set.resume();
                }
            }
            if (!completed && !truncated) {
                process.destroyForcibly();
                return errorResponse("Timeout", "Java execution exceeded its 8-second trace limit.", null);
            }
            if (truncated && process.isAlive()) process.destroyForcibly();
            if (!process.waitFor(2, TimeUnit.SECONDS)) process.destroyForcibly();
            String processOutput = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            String resultJson = markerValue(processOutput, "__ALGOLENS_RESULT__");
            String errorText = markerValue(processOutput, "__ALGOLENS_ERROR__");
            String stdout = markerValue(processOutput, "__ALGOLENS_STDOUT__");
            outputTruncated = Boolean.parseBoolean(markerValue(processOutput, "__ALGOLENS_OUTPUT_TRUNCATED__"));

            Map<String, Object> response;
            if (errorText != null) {
                String[] parts = errorText.split(":", 2);
                response = errorResponse(parts[0], parts.length > 1 ? parts[1] : parts[0], exceptionLine());
            } else if (resultJson == null) {
                response = errorResponse("RunnerError", "Java execution stopped before returning a result.", null);
            } else {
                response = new LinkedHashMap<>();
                response.put("status", "ok");
                response.put("result", resultSnapshot(Json.parse(resultJson)));
            }
            response.put("events", events);
            response.put("stdout", stdout == null ? "" : stdout.substring(0, Math.min(stdout.length(), MAX_OUTPUT_BYTES)));
            response.put("outputTruncated", outputTruncated);
            response.put("truncated", truncated);
            return response;
        } finally {
            if (vm != null) {
                try {
                    vm.dispose();
                } catch (RuntimeException ignored) {
                    // The debuggee may already have exited.
                }
            }
            if (process != null && process.isAlive()) process.destroyForcibly();
            try (var paths = Files.walk(directory)) {
                paths.sorted((left, right) -> right.compareTo(left)).forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (Exception ignored) {
                        // Cleanup is best-effort inside this disposable container.
                    }
                });
            }
        }
    }

    private List<Map<String, Object>> compile(Path sourceFile, Path directory) throws Exception {
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) throw new IllegalStateException("A Java compiler is unavailable in the sandbox.");
        DiagnosticCollector<JavaFileObject> collector = new DiagnosticCollector<>();
        try (var files = compiler.getStandardFileManager(collector, null, StandardCharsets.UTF_8)) {
            Iterable<? extends JavaFileObject> units = files.getJavaFileObjects(sourceFile.toFile());
            List<String> options = List.of("-g", "-proc:none", "-d", directory.toString(), "-classpath", "/runner");
            boolean success = Boolean.TRUE.equals(compiler.getTask(null, files, collector, options, null, units).call());
            if (success) return List.of();
        }
        List<Map<String, Object>> errors = new ArrayList<>();
        for (Diagnostic<? extends JavaFileObject> diagnostic : collector.getDiagnostics()) {
            if (diagnostic.getKind() != Diagnostic.Kind.ERROR || errors.size() >= 20) continue;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("line", diagnostic.getLineNumber() > 0 ? diagnostic.getLineNumber() : null);
            item.put("message", diagnostic.getMessage(null).substring(0, Math.min(300, diagnostic.getMessage(null).length())));
            errors.add(item);
        }
        return errors;
    }

    private void capture(ThreadReference thread, int line, String kind) {
        try {
            var frames = thread.frames();
            int frameDepth = 0;
            for (int index = 0; index < frames.size(); index++) {
                if (frames.get(index).location().declaringType().name().equals("Solution")) {
                    frameDepth = index;
                    break;
                }
            }
            var frame = frames.get(frameDepth);
            var variables = frame.visibleVariables();
            Map<String, Object> locals = new LinkedHashMap<>();
            Snapshot snapshot = new Snapshot();
            for (var variable : variables) {
                locals.put(variable.name(), snapshot.encode(frame.getValue(variable), 0));
                if (locals.size() >= 64) break;
            }
            Map<String, Object> event = new LinkedHashMap<>();
            event.put("sequence", events.size());
            event.put("kind", kind);
            event.put("line", Math.max(1, line));
            event.put("function", frame.location().method().name());
            event.put("frameId", thread.uniqueID() * 1000 + frameDepth);
            event.put("parentFrameId", frameDepth + 1 < frames.size() ? thread.uniqueID() * 1000 + frameDepth + 1 : null);
            event.put("locals", locals);
            event.put("heap", snapshot.nodes);
            long bytes = Json.stringify(event).length();
            if (events.size() >= MAX_EVENTS || traceBytes + bytes > MAX_TRACE_BYTES) {
                truncated = true;
                return;
            }
            traceBytes += bytes;
            events.add(event);
        } catch (AbsentInformationException ignored) {
            addMarkerEvent(thread, line, kind, "Local variable debug information is unavailable for this frame.");
        } catch (Exception ignored) {
            addMarkerEvent(thread, line, kind, "Runtime snapshot is unavailable for this event.");
        }
    }

    private void addMarkerEvent(ThreadReference thread, int line, String kind, String message) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("sequence", events.size());
        event.put("kind", kind);
        event.put("line", Math.max(1, line));
        event.put("function", "Solution");
        event.put("frameId", thread.uniqueID() * 1000);
        event.put("parentFrameId", null);
        event.put("locals", Map.of("snapshot", message));
        event.put("heap", List.of());
        events.add(event);
    }

    private Map<String, Object> resultSnapshot(Object result) {
        Snapshot snapshot = new Snapshot();
        Object encoded = encodeHostValue(result, snapshot, 0);
        Map<String, Object> output = new LinkedHashMap<>();
        output.put("value", encoded);
        output.put("heap", snapshot.nodes);
        return output;
    }

    private Object encodeHostValue(Object value, Snapshot snapshot, int depth) {
        if (value == null || value instanceof String || value instanceof Number || value instanceof Boolean) return value;
        if (depth > 4 || snapshot.nodes.size() >= MAX_HEAP_NODES) return Map.of("type", "Object", "summary", "<snapshot limit>");
        String id = "@r" + (snapshot.nodes.size() + 1);
        List<Object> items = new ArrayList<>();
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("id", id);
        node.put("type", value.getClass().getSimpleName());
        node.put("kind", "sequence");
        snapshot.nodes.add(node);
        int length = value.getClass().isArray() ? Array.getLength(value) : value instanceof List<?> list ? list.size() : 0;
        for (int index = 0; index < Math.min(length, MAX_ITEMS); index++) {
            items.add(encodeHostValue(value.getClass().isArray() ? Array.get(value, index) : ((List<?>) value).get(index), snapshot, depth + 1));
        }
        if (length > MAX_ITEMS) node.put("truncated", true);
        node.put("items", items);
        return Map.of("$ref", id);
    }

    private int exceptionLine() {
        for (int index = events.size() - 1; index >= 0; index--) {
            if (events.get(index).get("kind").equals("exception")) return (int) events.get(index).get("line");
        }
        return 0;
    }

    private static Map<String, Object> invalid(String message) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "invalid_request");
        response.put("error", message);
        return response;
    }

    private static Map<String, Object> errorResponse(String type, String message, Integer line) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "error");
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("type", type);
        error.put("message", message);
        error.put("line", line);
        response.put("error", error);
        return response;
    }

    private static Integer firstLine(List<Map<String, Object>> diagnostics) {
        Object line = diagnostics.get(0).get("line");
        return line instanceof Number number ? number.intValue() : null;
    }

    private static String markerValue(String output, String marker) {
        int start = output.indexOf(marker);
        if (start < 0) return null;
        start += marker.length();
        int end = output.indexOf('\n', start);
        return output.substring(start, end < 0 ? output.length() : end).stripTrailing();
    }

    private static LaunchingConnector defaultConnector() {
        VirtualMachineManager manager = com.sun.jdi.Bootstrap.virtualMachineManager();
        return manager.launchingConnectors().stream()
            .filter(connector -> connector.name().equals("com.sun.jdi.CommandLineLaunch"))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("Java debugging connector is unavailable."));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Map<?, ?> map) {
        return (Map<String, Object>) map;
    }

    private static final class Snapshot {
        private final List<Map<String, Object>> nodes = new ArrayList<>();
        private final Map<Long, String> ids = new HashMap<>();

        Object encode(Value value, int depth) {
            if (value == null) return null;
            if (value instanceof StringReference text) return text.value().substring(0, Math.min(text.value().length(), 256));
            if (value instanceof PrimitiveValue primitive) return primitive(primitive);
            if (!(value instanceof ObjectReference object)) return Map.of("type", "Value", "summary", "<unavailable>");
            long objectId = object.uniqueID();
            if (ids.containsKey(objectId)) return Map.of("$ref", ids.get(objectId));
            if (depth >= 4 || nodes.size() >= MAX_HEAP_NODES) return Map.of("type", object.referenceType().name(), "summary", "<snapshot limit>");

            String id = "@h" + (nodes.size() + 1);
            ids.put(objectId, id);
            String type = object.referenceType().name();
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("id", id);
            node.put("type", type.substring(type.lastIndexOf('.') + 1));
            node.put("kind", "sequence");
            nodes.add(node);
            List<Object> items = new ArrayList<>();

            if (object instanceof ArrayReference array) {
                int count = Math.min(array.length(), MAX_ITEMS);
                for (int index = 0; index < count; index++) items.add(encode(array.getValue(index), depth + 1));
                if (array.length() > count) node.put("truncated", true);
            } else if (type.startsWith("java.lang.")) {
                node.put("summary", "Java runtime object");
            } else {
                try {
                    List<com.sun.jdi.Field> fields = object.referenceType().allFields();
                    for (com.sun.jdi.Field field : fields) {
                        if (field.isStatic() || items.size() >= MAX_ITEMS) continue;
                        Map<String, Object> entry = new LinkedHashMap<>();
                        entry.put("name", field.name());
                        entry.put("value", encode(object.getValue(field), depth + 1));
                        items.add(entry);
                    }
                } catch (Exception ignored) {
                    node.put("summary", "Object fields unavailable");
                }
                node.put("kind", "mapping");
                List<Object> entries = new ArrayList<>();
                for (Object item : items) {
                    if (item instanceof Map<?, ?> field) {
                        entries.add(List.of(field.get("name"), field.get("value")));
                    }
                }
                node.put("entries", entries);
            }
            node.put("items", items);
            return Map.of("$ref", id);
        }

        private Object primitive(PrimitiveValue value) {
            if (value instanceof BooleanValue item) return item.value();
            if (value instanceof ByteValue item) return item.value();
            if (value instanceof ShortValue item) return item.value();
            if (value instanceof IntegerValue item) return item.value();
            if (value instanceof LongValue item) return item.value();
            if (value instanceof FloatValue item) return item.value();
            if (value instanceof DoubleValue item) return item.value();
            if (value instanceof CharValue item) return String.valueOf(item.value());
            return value.toString();
        }
    }
}
