function requireFeature(feature) {
  return (req, res, next) => {
    const features = JSON.parse(req.agency.features || '{}');
    if (features[feature] === true) {
      next();
    } else {
      res.status(403).json({ error: 'Feature not available in your plan' });
    }
  };
}
module.exports = requireFeature;