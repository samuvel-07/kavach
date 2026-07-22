import React, { useState } from 'react';

export default function OfficerNotes({ notes }) {
  const [newNote, setNewNote] = useState('');
  const [localNotes, setLocalNotes] = useState(notes || []);

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    
    const noteObj = {
      officer: 'Current User', // Mocked user
      note: newNote,
      timestamp: new Date().toLocaleString()
    };
    
    setLocalNotes([...localNotes, noteObj]);
    setNewNote('');
  };

  return (
    <div className="notes-container">
      <div className="notes-list">
        {localNotes.length === 0 && <div className="workspace-empty-state">No notes added yet.</div>}
        {localNotes.map((note, i) => (
          <div key={i} className="note-card fade-in-up">
            <div className="note-header">
              <span className="note-officer">{note.officer}</span>
              <span className="note-time">{note.timestamp}</span>
            </div>
            <div className="note-body">{note.note}</div>
          </div>
        ))}
      </div>
      
      <div className="add-note-section">
        <textarea 
          placeholder="Add a new observation or note..." 
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={3}
        />
        <button onClick={handleAddNote} className="btn-add-note">Add Note</button>
      </div>
    </div>
  );
}
