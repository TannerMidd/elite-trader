"""Small Draft-04 validator for the constructs used by EDDN's schemas.

Keeping this test-only avoids adding a runtime dependency while still running
emitted envelopes against the unmodified official schema files offline.
"""

import json
import re
from datetime import datetime


def validate(instance, schema):
    _validate(instance, schema, schema, "$")


def _fail(path, message):
    raise AssertionError(f"{path}: {message}")


def _matches_type(value, expected):
    if expected == "null":
        return value is None
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "string":
        return isinstance(value, str)
    if expected == "array":
        return isinstance(value, list)
    if expected == "object":
        return isinstance(value, dict)
    return False


def _resolve(root, reference):
    if not reference.startswith("#/"):
        raise AssertionError(f"unsupported external schema reference: {reference}")
    value = root
    for part in reference[2:].split("/"):
        value = value[part.replace("~1", "/").replace("~0", "~")]
    return value


def _validate(instance, schema, root, path):
    if "$ref" in schema:
        _validate(instance, _resolve(root, schema["$ref"]), root, path)
        return

    if "not" in schema:
        try:
            _validate(instance, schema["not"], root, path)
        except AssertionError:
            pass
        else:
            _fail(path, "matched forbidden schema")

    expected = schema.get("type")
    if expected is not None:
        choices = expected if isinstance(expected, list) else [expected]
        if not any(_matches_type(instance, choice) for choice in choices):
            _fail(path, f"expected type {choices}, got {type(instance).__name__}")

    if "enum" in schema and instance not in schema["enum"]:
        _fail(path, f"{instance!r} not in enum")

    if isinstance(instance, str):
        if len(instance) < schema.get("minLength", 0):
            _fail(path, "string shorter than minLength")
        if "pattern" in schema and re.search(schema["pattern"], instance) is None:
            _fail(path, f"string does not match {schema['pattern']!r}")
        if schema.get("format") == "date-time":
            try:
                datetime.fromisoformat(instance.replace("Z", "+00:00"))
            except ValueError:
                _fail(path, "invalid date-time")

    if isinstance(instance, list):
        if len(instance) < schema.get("minItems", 0):
            _fail(path, "array shorter than minItems")
        if "maxItems" in schema and len(instance) > schema["maxItems"]:
            _fail(path, "array longer than maxItems")
        if schema.get("uniqueItems"):
            encoded = [json.dumps(item, sort_keys=True, separators=(",", ":")) for item in instance]
            if len(set(encoded)) != len(encoded):
                _fail(path, "array items are not unique")
        item_schema = schema.get("items")
        if isinstance(item_schema, dict):
            for index, item in enumerate(instance):
                _validate(item, item_schema, root, f"{path}[{index}]")

    if isinstance(instance, dict):
        properties = schema.get("properties", {})
        patterns = schema.get("patternProperties", {})
        for required in schema.get("required", []):
            if required not in instance:
                _fail(path, f"missing required property {required!r}")
        for key, value in instance.items():
            matched = False
            if key in properties:
                matched = True
                _validate(value, properties[key], root, f"{path}.{key}")
            for pattern, sub_schema in patterns.items():
                if re.search(pattern, key):
                    matched = True
                    _validate(value, sub_schema, root, f"{path}.{key}")
            if not matched:
                additional = schema.get("additionalProperties", True)
                if additional is False:
                    _fail(path, f"additional property {key!r} is forbidden")
                if isinstance(additional, dict):
                    _validate(value, additional, root, f"{path}.{key}")
