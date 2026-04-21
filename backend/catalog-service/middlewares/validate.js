function badRequest(res, message) {
  return res.status(400).json({ success: false, message });
}

function requireFields(fields = []) {
  return function validateRequiredFields(req, res, next) {
    const body = req.body || {};
    for (const field of fields) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return badRequest(res, `Thiếu trường bắt buộc: ${field}`);
      }
    }
    return next();
  };
}

function validateEnum(field, allowedValues = []) {
  return function validateEnumField(req, res, next) {
    const value = req.body?.[field];
    if (value === undefined || value === null) return next();
    if (!allowedValues.includes(value)) {
      return badRequest(res, `${field} không hợp lệ`);
    }
    return next();
  };
}

function validateNumberRange(field, { min = null, max = null } = {}) {
  return function validateNumberRangeField(req, res, next) {
    const value = req.body?.[field];
    if (value === undefined || value === null || value === '') return next();
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
      return badRequest(res, `${field} phải là số hợp lệ`);
    }
    if (min !== null && numberValue < min) {
      return badRequest(res, `${field} phải >= ${min}`);
    }
    if (max !== null && numberValue > max) {
      return badRequest(res, `${field} phải <= ${max}`);
    }
    return next();
  };
}

function validateDateWindow(startField, endField) {
  return function validateDateWindowFields(req, res, next) {
    const start = req.body?.[startField];
    const end = req.body?.[endField];
    if (!start || !end) return next();
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return badRequest(res, `${startField}/${endField} không đúng định dạng ngày`);
    }
    if (startDate > endDate) {
      return badRequest(res, `${startField} phải nhỏ hơn hoặc bằng ${endField}`);
    }
    return next();
  };
}

module.exports = {
  requireFields,
  validateEnum,
  validateNumberRange,
  validateDateWindow,
  badRequest,
};
