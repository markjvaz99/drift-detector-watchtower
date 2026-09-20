import type { AttributeValue } from "../types";

interface TypedValueEnvelope {
  stringValue?: string;
  intValue?: number | string;
  doubleValue?: number;
  boolValue?: boolean;
  arrayValue?: { values?: TypedValueEnvelope[] };
}

export function unwrapTypedValue(envelope: TypedValueEnvelope | undefined): AttributeValue {
  if (!envelope) return "";
  if (envelope.stringValue !== undefined) return envelope.stringValue;
  if (envelope.intValue !== undefined) return Number(envelope.intValue);
  if (envelope.doubleValue !== undefined) return envelope.doubleValue;
  if (envelope.boolValue !== undefined) return envelope.boolValue;
  if (envelope.arrayValue !== undefined) {
    return (envelope.arrayValue.values ?? []).map(unwrapTypedValue);
  }
  return "";
}

export function unwrapAttributes(
  rawAttributes: Array<{ key: string; value: TypedValueEnvelope }> | undefined,
): Record<string, AttributeValue> {
  const result: Record<string, AttributeValue> = {};
  for (const attr of rawAttributes ?? []) {
    result[attr.key] = unwrapTypedValue(attr.value);
  }
  return result;
}
