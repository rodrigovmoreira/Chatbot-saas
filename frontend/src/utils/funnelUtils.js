export const groupContacts = (contacts, columns) => {
  const initialData = {};

  // Initialize all columns
  columns.forEach(col => {
    initialData[col.tag] = [];
  });
  initialData['Unassigned'] = [];

  // Optimization: Sort columns once by order (descending)
  // This avoids sorting N times inside the loop (where N is number of contacts)
  const sortedCols = [...columns].sort((a, b) => b.order - a.order);

  contacts.forEach(contact => {
    let assigned = false;
    // Iterate through sorted columns to find the highest priority match
    for (const col of sortedCols) {
      if (contact.tags && contact.tags.includes(col.tag)) {
        initialData[col.tag].push(contact);
        assigned = true;
        break; // Stop at highest priority match
      }
    }

    if (!assigned) {
      initialData['Unassigned'].push(contact);
    }
  });

  return initialData;
};
