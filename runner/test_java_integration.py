import json
import shutil
import subprocess
import unittest

from runner.server import run_in_sandbox


def docker_available():
    if shutil.which("docker") is None:
        return False
    result = subprocess.run(
        ["docker", "info", "--format", "{{.ServerVersion}}"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=5,
        check=False,
    )
    return result.returncode == 0


@unittest.skipUnless(docker_available(), "Docker Desktop's Linux engine is required for Java sandbox integration tests.")
class JavaSandboxIntegrationTests(unittest.TestCase):
    def assert_containers_cleaned(self):
        containers = subprocess.run(
            ["docker", "ps", "--all", "--quiet", "--filter", "label=algolens.managed=true"],
            capture_output=True,
            timeout=5,
            check=False,
        )
        self.assertEqual(containers.returncode, 0)
        self.assertEqual(containers.stdout.strip(), b"")

    def test_captures_java_lines_locals_heap_and_result(self):
        response = run_in_sandbox({
            "language": "java",
            "source": """class Solution {
    public int maxSubArray(int[] nums) {
        int current = nums[0];
        int best = nums[0];
        for (int i = 1; i < nums.length; i++) {
            current = Math.max(nums[i], current + nums[i]);
            best = Math.max(best, current);
        }
        return best;
    }
}""",
            "method": "maxSubArray",
            "arguments": [[-2, 1, -3, 4, -1, 2, 1, -5, 4]],
        })

        self.assertEqual(response["status"], "ok")
        self.assertEqual(response["result"]["value"], 6)
        method_events = [event for event in response["events"] if event["function"] == "maxSubArray"]
        self.assertGreater(len(method_events), 10)
        self.assertTrue(any(event["line"] == 6 and event["locals"].get("current") == 1 for event in method_events))
        self.assertTrue(any(event["heap"] for event in method_events))
        self.assert_containers_cleaned()

    def test_reports_java_compile_diagnostic_and_line(self):
        response = run_in_sandbox({
            "language": "java",
            "source": "class Solution { public int solve(int[] nums) { return nums.length; }",
            "method": "solve",
            "arguments": [[1]],
        })

        self.assertEqual(response["status"], "error")
        self.assertEqual(response["error"]["type"], "CompileError")
        self.assertEqual(response["error"]["line"], 1)
        self.assertTrue(response["diagnostics"])
        self.assert_containers_cleaned()

    def test_converts_generic_java_list_arguments(self):
        response = run_in_sandbox({
            "language": "java",
            "source": """import java.util.List;
class Solution {
    public int sum(List<Integer> values) {
        int result = 0;
        for (int value : values) result += value;
        return result;
    }
}""",
            "method": "sum",
            "arguments": [[2, 3, 4]],
        })

        self.assertEqual(response["status"], "ok")
        self.assertEqual(response["result"]["value"], 9)
        self.assert_containers_cleaned()

    def test_reports_java_runtime_exception_with_source_line(self):
        response = run_in_sandbox({
            "language": "java",
            "source": """class Solution {
    public int solve(int[] nums) {
        return nums[8];
    }
}""",
            "method": "solve",
            "arguments": [[1]],
        })

        self.assertEqual(response["status"], "error")
        self.assertEqual(response["error"]["type"], "ArrayIndexOutOfBoundsException")
        self.assertEqual(response["error"]["line"], 3)
        self.assertTrue(response["events"])
        self.assert_containers_cleaned()


if __name__ == "__main__":
    unittest.main()
