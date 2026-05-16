const ChatLog = require('../models/ChatLog');

/**
 * GET /projects/:id/logs
 * Returns paginated chat logs for a project.
 * Query params: page, pageSize, search
 */
exports.getLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || 20);
    const search = req.query.search?.trim();

    const filter = { projectId: id };
    if (search) {
      filter.$or = [
        { query: { $regex: search, $options: 'i' } },
        { response: { $regex: search, $options: 'i' } },
      ];
    }

    const [logs, total] = await Promise.all([
      ChatLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .select('query response provider model latencyMs hasRagHits toolCallsMade accuracyScore accuracyNote createdAt'),
      ChatLog.countDocuments(filter),
    ]);

    res.json({
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('getLogs error:', error);
    res.status(500).json({ error: 'Server error fetching logs.' });
  }
};

/**
 * GET /projects/:id/logs/:logId
 * Returns a single log entry with full detail.
 */
exports.getLog = async (req, res) => {
  try {
    const { id, logId } = req.params;
    const log = await ChatLog.findOne({ _id: logId, projectId: id });
    if (!log) return res.status(404).json({ error: 'Log entry not found.' });
    res.json(log);
  } catch (error) {
    console.error('getLog error:', error);
    res.status(500).json({ error: 'Server error fetching log.' });
  }
};

/**
 * DELETE /projects/:id/logs
 * Clears all logs for a project.
 */
exports.clearLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await ChatLog.deleteMany({ projectId: id });
    res.json({ message: `${result.deletedCount} log(s) cleared for this project.` });
  } catch (error) {
    console.error('clearLogs error:', error);
    res.status(500).json({ error: 'Server error clearing logs.' });
  }
};

/**
 * GET /projects/:id/logs/stats
 * Returns aggregated accuracy stats for a project.
 */
exports.getLogStats = async (req, res) => {
  try {
    const { id } = req.params;

    const [stats] = await ChatLog.aggregate([
      { $match: { projectId: require('mongoose').Types.ObjectId.createFromHexString(id), accuracyScore: { $ne: null } } },
      {
        $group: {
          _id: null,
          avgAccuracy: { $avg: '$accuracyScore' },
          avgLatencyMs: { $avg: '$latencyMs' },
          totalLogs: { $sum: 1 },
          highAccuracy: { $sum: { $cond: [{ $gte: ['$accuracyScore', 80] }, 1, 0] } },
          mediumAccuracy: { $sum: { $cond: [{ $and: [{ $gte: ['$accuracyScore', 50] }, { $lt: ['$accuracyScore', 80] }] }, 1, 0] } },
          lowAccuracy: { $sum: { $cond: [{ $lt: ['$accuracyScore', 50] }, 1, 0] } },
        }
      }
    ]);

    const totalCount = await ChatLog.countDocuments({ projectId: id });

    res.json({
      totalLogs: totalCount,
      avgAccuracy: stats ? Math.round(stats.avgAccuracy) : null,
      avgLatencyMs: stats ? Math.round(stats.avgLatencyMs) : null,
      highAccuracy: stats?.highAccuracy || 0,
      mediumAccuracy: stats?.mediumAccuracy || 0,
      lowAccuracy: stats?.lowAccuracy || 0,
    });
  } catch (error) {
    console.error('getLogStats error:', error);
    res.status(500).json({ error: 'Server error fetching log stats.' });
  }
};
