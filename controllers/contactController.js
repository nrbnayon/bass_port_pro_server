const ContactMessage = require('../models/ContactMessage');
const AuditLog       = require('../models/AuditLog');
const {
  success, created, notFound, badRequest, serverError, forbidden
} = require('../utils/apiResponse');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Submit a contact message (public + authenticated users)
// @route   POST /api/contact
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
exports.submitContact = async (req, res) => {
  try {
    const { name, email, subject, message, category } = req.body;

    if (!name || !email || !subject || !message) {
      return badRequest(res, 'Name, email, subject and message are required');
    }

    // Simple email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return badRequest(res, 'Invalid email address');
    }

    const contact = await ContactMessage.create({
      user:      req.user?._id || null,
      name:      name.trim(),
      email:     email.trim().toLowerCase(),
      subject:   subject.trim(),
      message:   message.trim(),
      category:  category || 'general',
      ipAddress: req.ip || '',
    });

    // Optional: send email notification to admin
    try {
      const sendEmail = require('../utils/sendEmail');
      await sendEmail({
        email:   process.env.ADMIN_EMAIL || email,
        subject: `[BassInsight] New contact from ${name}: ${subject}`,
        message: `From: ${name} (${email})\nCategory: ${category || 'general'}\n\n${message}`,
      });
    } catch (emailErr) {
      console.warn('Contact notification email failed:', emailErr.message);
    }

    return created(res, {
      id: contact._id,
      status: contact.status,
    }, "Thank you! We've received your message and will respond within 24-48 hours.");
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all contact messages (Admin)
// @route   GET /api/contact
// @access  Private (Admin / Manager)
// ─────────────────────────────────────────────────────────────────────────────
exports.getContacts = async (req, res) => {
  try {
    const {
      page = 1, limit = 20,
      status = '', priority = '',
      category = '', search = '',
      sortBy = 'createdAt', order = 'desc'
    } = req.query;

    const query = {};
    if (status)   query.status   = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name:    { $regex: search, $options: 'i' } },
        { email:   { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [contacts, total] = await Promise.all([
      ContactMessage.find(query)
        .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('user', 'name avatar email')
        .populate('assignedTo', 'name')
        .lean(),
      ContactMessage.countDocuments(query),
    ]);

    return success(res, {
      contacts,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get single contact message (Admin)
// @route   GET /api/contact/:id
// @access  Private (Admin / Manager)
// ─────────────────────────────────────────────────────────────────────────────
exports.getContactById = async (req, res) => {
  try {
    const contact = await ContactMessage.findById(req.params.id)
      .populate('user', 'name avatar email')
      .populate('assignedTo', 'name')
      .lean();

    if (!contact) return notFound(res, 'Contact message not found');
    return success(res, { contact });
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update contact status / priority / notes (Admin)
// @route   PATCH /api/contact/:id
// @access  Private (Admin / Manager)
// ─────────────────────────────────────────────────────────────────────────────
exports.updateContact = async (req, res) => {
  try {
    const contact = await ContactMessage.findById(req.params.id);
    if (!contact) return notFound(res, 'Contact message not found');

    const { status, priority, assignedTo, adminNotes } = req.body;

    if (status)     contact.status     = status;
    if (priority)   contact.priority   = priority;
    if (assignedTo !== undefined) contact.assignedTo = assignedTo || null;
    if (adminNotes !== undefined) contact.adminNotes = adminNotes;

    if (status === 'resolved' && contact.status !== 'resolved') {
      contact.resolvedAt = new Date();
    }

    await contact.save();

    await AuditLog.create({
      user: req.user._id, action: 'CONTACT_UPDATE',
      target: contact._id, targetType: 'contact',
      details: { status, priority }
    });

    return success(res, { contact }, 'Contact message updated successfully');
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete contact message (Admin)
// @route   DELETE /api/contact/:id
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteContact = async (req, res) => {
  try {
    const contact = await ContactMessage.findById(req.params.id);
    if (!contact) return notFound(res, 'Contact message not found');

    if (req.user.role !== 'admin') return forbidden(res, 'Only admins can delete contact messages');

    await contact.deleteOne();
    return success(res, null, 'Contact message deleted');
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get current user's own submitted contacts
// @route   GET /api/contact/my
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyContacts = async (req, res) => {
  try {
    const contacts = await ContactMessage.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select('subject status priority category createdAt')
      .lean();

    return success(res, { contacts });
  } catch (error) {
    return serverError(res, error.message);
  }
};
