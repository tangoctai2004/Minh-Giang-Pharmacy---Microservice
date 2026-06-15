function renderTemplate(template, vars = {}) {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return vars[key] == null ? '' : String(vars[key]);
    }
    return `{{${key}}}`;
  });
}

module.exports = renderTemplate;
