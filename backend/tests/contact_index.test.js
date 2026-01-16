const Contact = require('../models/Contact');

describe('Contact Model Indexes', () => {
  it('should have the compound targeting index defined', () => {
    const indexes = Contact.schema.indexes();

    // Log indexes for debugging if needed
    // console.log(JSON.stringify(indexes, null, 2));

    const hasCompoundTargeting = indexes.some(idx =>
      idx[0].businessId === 1 &&
      idx[0].isHandover === 1 &&
      idx[0].tags === 1
    );

    expect(hasCompoundTargeting).toBe(true);
  });
});
