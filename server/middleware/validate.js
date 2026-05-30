function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body || {});
    if (!result.success) {
      return res.status(400).json({
        message: 'Request validation failed.',
        code: 'VALIDATION_ERROR',
        details: result.error.flatten()
      });
    }
    req.body = result.data;
    next();
  };
}

module.exports = validate;
