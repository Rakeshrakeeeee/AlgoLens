import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.lang.reflect.Array;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;

public final class Harness {
    private static final int MAX_OUTPUT = 65_536;

    public static void main(String[] arguments) {
        String methodName = arguments[0];
        Object parsedArguments = Json.parse(new String(java.util.Base64.getDecoder().decode(arguments[1]), StandardCharsets.UTF_8));
        if (!(parsedArguments instanceof List<?> input)) throw new IllegalArgumentException("Arguments must be a JSON array.");

        PrintStream originalOut = System.out;
        PrintStream originalErr = System.err;
        CappedOutput capture = new CappedOutput(MAX_OUTPUT);
        System.setOut(new PrintStream(capture, true, StandardCharsets.UTF_8));
        System.setErr(new PrintStream(capture, true, StandardCharsets.UTF_8));
        try {
            Class<?> solutionClass = Class.forName("Solution");
            Object receiver = null;
            Method selected = null;
            for (Method candidate : solutionClass.getMethods()) {
                if (!candidate.getName().equals(methodName) || candidate.getParameterCount() != input.size()) continue;
                if (selected != null) throw new IllegalArgumentException("The selected method name is overloaded ambiguously.");
                selected = candidate;
            }
            if (selected == null) {
                for (Method candidate : solutionClass.getDeclaredMethods()) {
                    if (!candidate.getName().equals(methodName) || candidate.getParameterCount() != input.size()) continue;
                    if (selected != null) throw new IllegalArgumentException("The selected method name is overloaded ambiguously.");
                    selected = candidate;
                }
            }
            if (selected == null) throw new NoSuchMethodException("No method with the selected name and argument count was found.");
            if (!Modifier.isStatic(selected.getModifiers())) {
                receiver = solutionClass.getDeclaredConstructor().newInstance();
            }
            if (!selected.canAccess(receiver)) selected.setAccessible(true);
            Type[] parameterTypes = selected.getGenericParameterTypes();
            Object[] converted = new Object[input.size()];
            for (int index = 0; index < input.size(); index++) converted[index] = convert(input.get(index), parameterTypes[index]);
            Object result = selected.invoke(receiver, converted);
            originalOut.println("__ALGOLENS_RESULT__" + Json.stringify(toJsonValue(result, new IdentityHashMap<>(), 0)));
        } catch (Throwable error) {
            Throwable root = error;
            while (root.getCause() != null) root = root.getCause();
            originalOut.println("__ALGOLENS_ERROR__" + root.getClass().getSimpleName() + ":" + safeMessage(root));
        } finally {
            System.setOut(originalOut);
            System.setErr(originalErr);
            originalOut.println("__ALGOLENS_STDOUT__" + capture.text());
            originalOut.println("__ALGOLENS_OUTPUT_TRUNCATED__" + capture.truncated);
        }
    }

    private static String safeMessage(Throwable error) {
        String message = error.getMessage();
        if (message == null) return error.getClass().getSimpleName();
        return message.length() > 300 ? message.substring(0, 300) : message;
    }

    private static Object toJsonValue(Object value, IdentityHashMap<Object, Boolean> visited, int depth) {
        if (value == null || value instanceof String || value instanceof Number || value instanceof Boolean) return value;
        if (depth >= 8 || visited.containsKey(value)) return "<object>";
        visited.put(value, Boolean.TRUE);
        if (value.getClass().isArray()) {
            int length = Math.min(Array.getLength(value), 256);
            List<Object> result = new ArrayList<>();
            for (int index = 0; index < length; index++) result.add(toJsonValue(Array.get(value, index), visited, depth + 1));
            if (Array.getLength(value) > length) result.add("<truncated>");
            visited.remove(value);
            return result;
        }
        if (value instanceof List<?> list) {
            List<Object> result = new ArrayList<>();
            for (int index = 0; index < Math.min(list.size(), 256); index++) {
                result.add(toJsonValue(list.get(index), visited, depth + 1));
            }
            if (list.size() > 256) result.add("<truncated>");
            visited.remove(value);
            return result;
        }
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> result = new java.util.LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (result.size() >= 128 || !(entry.getKey() instanceof String key)) continue;
                result.put(key, toJsonValue(entry.getValue(), visited, depth + 1));
            }
            visited.remove(value);
            return result;
        }
        visited.remove(value);
        return "<" + value.getClass().getSimpleName() + ">";
    }

    private static Object convert(Object value, Type targetType) {
        if (targetType instanceof ParameterizedType parameterized && parameterized.getRawType() instanceof Class<?> rawType) {
            if (List.class.isAssignableFrom(rawType) && value instanceof List<?> input) {
                List<Object> converted = new ArrayList<>();
                for (Object item : input) converted.add(convert(item, parameterized.getActualTypeArguments()[0]));
                return converted;
            }
            if (Map.class.isAssignableFrom(rawType) && value instanceof Map<?, ?> input) {
                Map<Object, Object> converted = new java.util.LinkedHashMap<>();
                Type keyType = parameterized.getActualTypeArguments()[0];
                Type valueType = parameterized.getActualTypeArguments()[1];
                for (Map.Entry<?, ?> entry : input.entrySet()) {
                    converted.put(convert(entry.getKey(), keyType), convert(entry.getValue(), valueType));
                }
                return converted;
            }
            targetType = rawType;
        }
        if (!(targetType instanceof Class<?> target)) return value;
        if (value == null) {
            if (target.isPrimitive()) throw new IllegalArgumentException("null cannot be passed to a primitive parameter.");
            return null;
        }
        if (target.isArray()) {
            if (!(value instanceof List<?> list)) throw new IllegalArgumentException("Expected a JSON array argument.");
            Object result = Array.newInstance(target.getComponentType(), list.size());
            for (int index = 0; index < list.size(); index++) Array.set(result, index, convert(list.get(index), target.getComponentType()));
            return result;
        }
        if (target == String.class && value instanceof String) return value;
        if ((target == boolean.class || target == Boolean.class) && value instanceof Boolean) return value;
        if ((target == char.class || target == Character.class) && value instanceof String text && text.length() == 1) return text.charAt(0);
        if (target == byte.class || target == Byte.class) return number(value).byteValueExact();
        if (target == short.class || target == Short.class) return number(value).shortValueExact();
        if (target == int.class || target == Integer.class) return number(value).intValueExact();
        if (target == long.class || target == Long.class) return number(value).longValueExact();
        if (target == float.class || target == Float.class) return number(value).floatValue();
        if (target == double.class || target == Double.class) return number(value).doubleValue();
        if (List.class.isAssignableFrom(target) && value instanceof List<?>) return new ArrayList<>((List<?>) value);
        if (Map.class.isAssignableFrom(target) && value instanceof Map<?, ?>) return value;
        if (target == Object.class) return value;
        throw new IllegalArgumentException("The JSON argument cannot be converted to " + target.getTypeName() + ".");
    }

    private static java.math.BigDecimal number(Object value) {
        if (!(value instanceof Number number)) throw new IllegalArgumentException("Expected a numeric argument.");
        return new java.math.BigDecimal(number.toString());
    }

    private static final class CappedOutput extends ByteArrayOutputStream {
        private final int maximum;
        private boolean truncated;

        CappedOutput(int maximum) {
            this.maximum = maximum;
        }

        @Override
        public synchronized void write(byte[] data, int offset, int length) {
            int accepted = Math.min(length, maximum - count);
            if (accepted > 0) super.write(data, offset, accepted);
            if (accepted < length) truncated = true;
        }

        @Override
        public synchronized void write(int value) {
            if (count < maximum) super.write(value);
            else truncated = true;
        }

        String text() {
            return toString(StandardCharsets.UTF_8);
        }
    }
}
