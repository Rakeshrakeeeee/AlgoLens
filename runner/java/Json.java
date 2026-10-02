import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class Json {
    private Json() {}

    static Object parse(String text) {
        Parser parser = new Parser(text);
        Object result = parser.value(0);
        parser.space();
        if (parser.index != text.length()) throw new IllegalArgumentException("Unexpected JSON content.");
        return result;
    }

    static String stringify(Object value) {
        StringBuilder output = new StringBuilder();
        write(value, output, 0);
        return output.toString();
    }

    private static void write(Object value, StringBuilder output, int depth) {
        if (depth > 24) {
            output.append("\"<serialization limit>\"");
        } else if (value == null) {
            output.append("null");
        } else if (value instanceof String text) {
            quote(text, output);
        } else if (value instanceof Double number && !Double.isFinite(number)) {
            quote(number.toString(), output);
        } else if (value instanceof Float number && !Float.isFinite(number)) {
            quote(number.toString(), output);
        } else if (value instanceof Boolean || value instanceof Number) {
            output.append(value);
        } else if (value instanceof Map<?, ?> map) {
            output.append('{');
            boolean first = true;
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (!(entry.getKey() instanceof String key)) continue;
                if (!first) output.append(',');
                quote(key, output);
                output.append(':');
                write(entry.getValue(), output, depth + 1);
                first = false;
            }
            output.append('}');
        } else if (value instanceof Iterable<?> items) {
            output.append('[');
            boolean first = true;
            for (Object item : items) {
                if (!first) output.append(',');
                write(item, output, depth + 1);
                first = false;
            }
            output.append(']');
        } else {
            quote(String.valueOf(value), output);
        }
    }

    private static void quote(String text, StringBuilder output) {
        output.append('"');
        for (int index = 0; index < text.length(); index++) {
            char character = text.charAt(index);
            switch (character) {
                case '"' -> output.append("\\\"");
                case '\\' -> output.append("\\\\");
                case '\b' -> output.append("\\b");
                case '\f' -> output.append("\\f");
                case '\n' -> output.append("\\n");
                case '\r' -> output.append("\\r");
                case '\t' -> output.append("\\t");
                default -> {
                    if (character < 0x20) output.append(String.format("\\u%04x", (int) character));
                    else output.append(character);
                }
            }
        }
        output.append('"');
    }

    private static final class Parser {
        private final String source;
        private int index;

        private Parser(String source) {
            this.source = source;
        }

        private void space() {
            while (index < source.length() && Character.isWhitespace(source.charAt(index))) index++;
        }

        private Object value(int depth) {
            if (depth > 24) throw new IllegalArgumentException("JSON input is nested too deeply.");
            space();
            if (index >= source.length()) throw new IllegalArgumentException("Unexpected end of JSON input.");
            return switch (source.charAt(index)) {
                case '"' -> string();
                case '[' -> array(depth + 1);
                case '{' -> object(depth + 1);
                case 't' -> literal("true", Boolean.TRUE);
                case 'f' -> literal("false", Boolean.FALSE);
                case 'n' -> literal("null", null);
                default -> number();
            };
        }

        private Object literal(String text, Object value) {
            if (!source.startsWith(text, index)) throw new IllegalArgumentException("Invalid JSON value.");
            index += text.length();
            return value;
        }

        private String string() {
            index++;
            StringBuilder value = new StringBuilder();
            while (index < source.length()) {
                char character = source.charAt(index++);
                if (character == '"') return value.toString();
                if (character == '\\') {
                    if (index >= source.length()) break;
                    char escaped = source.charAt(index++);
                    switch (escaped) {
                        case '"', '\\', '/' -> value.append(escaped);
                        case 'b' -> value.append('\b');
                        case 'f' -> value.append('\f');
                        case 'n' -> value.append('\n');
                        case 'r' -> value.append('\r');
                        case 't' -> value.append('\t');
                        case 'u' -> {
                            if (index + 4 > source.length()) throw new IllegalArgumentException("Invalid JSON escape.");
                            value.append((char) Integer.parseInt(source.substring(index, index + 4), 16));
                            index += 4;
                        }
                        default -> throw new IllegalArgumentException("Invalid JSON escape.");
                    }
                } else {
                    value.append(character);
                }
            }
            throw new IllegalArgumentException("Unclosed JSON string.");
        }

        private List<Object> array(int depth) {
            index++;
            List<Object> result = new ArrayList<>();
            space();
            if (take(']')) return result;
            do {
                result.add(value(depth));
                space();
                if (take(']')) return result;
                if (!take(',')) throw new IllegalArgumentException("Expected ',' in JSON array.");
            } while (true);
        }

        private Map<String, Object> object(int depth) {
            index++;
            Map<String, Object> result = new LinkedHashMap<>();
            space();
            if (take('}')) return result;
            do {
                space();
                if (index >= source.length() || source.charAt(index) != '"') throw new IllegalArgumentException("Expected a JSON object key.");
                String key = string();
                space();
                if (!take(':')) throw new IllegalArgumentException("Expected ':' after JSON object key.");
                result.put(key, value(depth));
                space();
                if (take('}')) return result;
                if (!take(',')) throw new IllegalArgumentException("Expected ',' in JSON object.");
            } while (true);
        }

        private Object number() {
            int start = index;
            if (take('-') && index >= source.length()) throw new IllegalArgumentException("Invalid JSON number.");
            while (index < source.length() && Character.isDigit(source.charAt(index))) index++;
            if (take('.')) while (index < source.length() && Character.isDigit(source.charAt(index))) index++;
            if (index < source.length() && (source.charAt(index) == 'e' || source.charAt(index) == 'E')) {
                index++;
                if (index < source.length() && (source.charAt(index) == '+' || source.charAt(index) == '-')) index++;
                while (index < source.length() && Character.isDigit(source.charAt(index))) index++;
            }
            if (start == index) throw new IllegalArgumentException("Invalid JSON value.");
            String token = source.substring(start, index);
            try {
                if (token.indexOf('.') >= 0 || token.indexOf('e') >= 0 || token.indexOf('E') >= 0) return Double.valueOf(token);
                return Long.valueOf(token);
            } catch (NumberFormatException error) {
                return Double.valueOf(token);
            }
        }

        private boolean take(char expected) {
            if (index < source.length() && source.charAt(index) == expected) {
                index++;
                return true;
            }
            return false;
        }
    }
}
