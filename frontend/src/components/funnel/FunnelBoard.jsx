import React, { useState, useEffect } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { Box, Flex } from '@chakra-ui/react';
import FunnelColumn from './FunnelColumn';

const FunnelBoard = ({ columns, contacts }) => {
  const [boardData, setBoardData] = useState({});

  // Initialize/Reset Board Data when props change
  useEffect(() => {
    // 1. Create structure based on columns
    const initialData = {};
    columns.forEach(col => {
      initialData[col.tag] = [];
    });
    initialData['Unassigned'] = []; // Fallback column (optional, but good for safety)

    // 2. Distribute contacts
    contacts.forEach(contact => {
      // Find matching steps
      // Logic: If contact has multiple tags that match columns, prioritize the one with highest order index
      // But 'columns' array usually comes sorted by order from parent or we sort it here.
      // Let's assume 'columns' is sorted 0..N

      let assigned = false;
      // We iterate backwards to find the highest order match if multiple exist?
      // Or just first match? Use Case: Contact moved from Lead to Negotiation.
      // Usually we remove old tag. But if they have both, usually the "furthest" one counts.
      // Let's iterate through the sorted columns and see if contact has that tag.
      // Ideally, we want the "highest stage" (last in list).

      const sortedCols = [...columns].sort((a,b) => b.order - a.order); // Descending

      for (const col of sortedCols) {
         if (contact.tags && contact.tags.includes(col.tag)) {
            initialData[col.tag].push(contact);
            assigned = true;
            break; // Stop at highest priority match
         }
      }

      if (!assigned) {
         // Optionally put in Unassigned or just ignore?
         // Requirement says "display contacts grouped". If not in funnel, maybe don't show?
         // Or show in a backlog? For now, let's ignore or we can have a "Backlog" column.
         // Let's ignore unassigned for this specific Kanban view to keep it clean.
      }
    });

    setBoardData(initialData);
  }, [columns, contacts]);

  const onDragEnd = (result) => {
    const { source, destination } = result;

    // Dropped outside
    if (!destination) return;

    // Dropped in same place
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    // Reordering Logic (Visual Only for now)
    const sourceColId = source.droppableId;
    const destColId = destination.droppableId;

    const sourceList = [...boardData[sourceColId]];
    const destList = sourceColId === destColId ? sourceList : [...boardData[destColId]];

    const [movedContact] = sourceList.splice(source.index, 1);
    destList.splice(destination.index, 0, movedContact);

    setBoardData({
      ...boardData,
      [sourceColId]: sourceList,
      [destColId]: destList
    });

    // TODO: In Step 3.3, we will call API here
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Flex
        h="full"
        overflowX="auto"
        pb={4}
        css={{
          '&::-webkit-scrollbar': {
            height: '8px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#CBD5E0',
            borderRadius: '24px',
          },
        }}
      >
        {columns
          .sort((a, b) => a.order - b.order)
          .map(step => (
            <FunnelColumn
              key={step.tag}
              droppableId={step.tag}
              step={step}
              contacts={boardData[step.tag] || []}
            />
        ))}
      </Flex>
    </DragDropContext>
  );
};

export default FunnelBoard;
