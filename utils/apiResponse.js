/**
 * Unified API response utility for BassInsight backend.
 * Use these helpers in every controller to keep response shapes consistent.
 */

/**
 * 2xx Success response
 * @param {import('express').Response} res
 * @param {string} message  - Human-readable message
 * @param {*}      data     - Payload (object, array, null, etc.)
 * @param {number} [status=200]
 */
const successResponse = (res, message, data = null, status = 200) => {
  const body = {
    success: true,
    message,
  };
  if (data !== null && data !== undefined) {
    body.data = data;
  }
  return res.status(status).json(body);
};

/**
 * 201 Created response
 */
const createdResponse = (res, message, data = null) =>
  successResponse(res, message, data, 201);

/**
 * Paginated list response
 * @param {import('express').Response} res
 * @param {string} message
 * @param {Array}  items
 * @param {{ page, limit, total }} pagination
 */
const paginatedResponse = (res, message, items, pagination) => {
  const { page, limit, total } = pagination;
  return res.status(200).json({
    success: true,
    message,
    data: items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });
};

/**
 * Error response
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} [status=400]
 * @param {*}      [errors=null]  - Field-level validation errors, etc.
 */
const errorResponse = (res, message, status = 400, errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(status).json(body);
};

/** Shorthand helpers */
const notFound      = (res, message = 'Resource not found') => errorResponse(res, message, 404);
const unauthorized  = (res, message = 'Not authorized')      => errorResponse(res, message, 401);
const forbidden     = (res, message = 'Forbidden')           => errorResponse(res, message, 403);
const serverError   = (res, err) => {
  console.error('[ServerError]', err);

  // Handle Mongoose / Validator errors nicely for the user
  if (err?.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    return errorResponse(res, `Data Validation Error: ${message}`, 400);
  }

  return errorResponse(res, err?.message || 'Internal server error', 500);
};

/** Short-name aliases (preferred in new controllers) */
const success    = (res, data, message = 'Success')     => res.status(200).json({ success: true, message, ...data });
const created    = (res, data, message = 'Created')     => res.status(201).json({ success: true, message, ...data });
const badRequest = (res, message = 'Bad request')       => errorResponse(res, message, 400);

module.exports = {
  // Verbose originals
  successResponse,
  createdResponse,
  paginatedResponse,
  errorResponse,
  // Shorthand helpers (use these in new controllers)
  success,
  created,
  badRequest,
  notFound,
  unauthorized,
  forbidden,
  serverError,
};
