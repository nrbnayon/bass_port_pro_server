const Job = require('../models/Job');
const Application = require('../models/Application');

// @desc    Get dashboard stats
// @route   GET /api/dashboard/stats
// @access  Public (in real app: Admin)
exports.getStats = async (req, res) => {
  try {
    const totalJobs = await Job.countDocuments();
    const totalApplications = await Application.countDocuments();
    const remoteRoles = await Job.countDocuments({ 
        $or: [
            { type: { $regex: 'remote', $options: 'i' } },
            { location: { $regex: 'remote', $options: 'i' } }
        ]
    });

    // We emulate the data structure from frontend statsData.ts
    // with actual data mixed with mock data where tables aren't present yet.
    const statsData = [
      {
        title: "Total Jobs",
        value: totalJobs.toString(),
        subtitle: "12% Up from last month",
        iconName: "Briefcase",
        iconColor: "#4640DE",
        iconBgColor: "#4640DE10",
      },
      {
        title: "Applications",
        value: totalApplications.toString(),
        subtitle: "8.5% Up from last month",
        iconName: "Users",
        iconColor: "#56CDAD",
        iconBgColor: "#56CDAD10",
      },
      {
        title: "Talent Pool",
        value: "12,850",
        subtitle: "New members today",
        iconName: "FileText",
        iconColor: "#26A4FF",
        iconBgColor: "#26A4FF10",
      },
      {
        title: "Remote Roles",
        value: remoteRoles.toString(),
        subtitle: "Global opportunities",
        iconName: "MapPin",
        iconColor: "#FF6550",
        iconBgColor: "#FF655010",
      },
      {
        title: "Success Rate",
        value: "78%",
        subtitle: "Interviews scheduled",
        iconName: "TrendingUp",
        iconColor: "#FFB836",
        iconBgColor: "#FFB83610",
      },
    ];

    res.status(200).json({
      success: true,
      data: statsData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};
