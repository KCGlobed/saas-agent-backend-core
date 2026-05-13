/**
 * Build LLM tool schemas from collection.json `apis` entries.
 */

function specToProperty(key, spec) {
  if (typeof spec === 'string') {
    return { type: 'string', description: spec };
  }
  if (!spec || typeof spec !== 'object') {
    return { type: 'string', description: `Query parameter ${key}` };
  }
  let jsonType = 'string';
  if (spec.type === 'number' || spec.type === 'integer') jsonType = 'number';
  if (spec.type === 'boolean') jsonType = 'boolean';
  const prop = { type: jsonType };
  if (spec.description) prop.description = spec.description;
  if (spec.enum) prop.enum = spec.enum;
  if (spec.default !== undefined) {
    prop.description = [prop.description, `Default if omitted: ${JSON.stringify(spec.default)}.`]
      .filter(Boolean)
      .join(' ');
  }
  return prop;
}

function queryParamsToJsonSchema(queryParams) {
  if (!queryParams || typeof queryParams !== 'object') {
    return { type: 'object', properties: {}, additionalProperties: true };
  }
  const properties = {};
  for (const [key, spec] of Object.entries(queryParams)) {
    properties[key] = specToProperty(key, spec);
  }
  return { type: 'object', properties, additionalProperties: true };
}

function buildApiDescription(api) {
  const bits = [api.description, api.purpose, api.when_to_use].filter((x) => x && String(x).trim());
  const text = bits.join(' ').trim();
  return text || `HTTP API: ${api.name}`;
}

function buildOpenAITools(collection) {
  const apis = collection?.apis;
  if (!Array.isArray(apis)) return [];
  return apis.map((api) => ({
    type: 'function',
    function: {
      name: api.name,
      description: buildApiDescription(api),
      parameters: queryParamsToJsonSchema(api.query_params),
    },
  }));
}

function buildClaudeTools(collection) {
  const apis = collection?.apis;
  if (!Array.isArray(apis)) return [];
  return apis.map((api) => ({
    name: api.name,
    description: buildApiDescription(api),
    input_schema: queryParamsToJsonSchema(api.query_params),
  }));
}

module.exports = { buildOpenAITools, buildClaudeTools, buildApiDescription };
