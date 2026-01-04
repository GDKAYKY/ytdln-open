import React, { useRef, useEffect } from 'react';

const Console = ({ isOpen, status }) => {
  const consoleBoxRef = useRef(null);

  useEffect(() => {
    if (consoleBoxRef.current) {
        consoleBoxRef.current.scrollTop = consoleBoxRef.current.scrollHeight;
    }
  }, [status]);

  return (
      <div className={`console-section ${!isOpen ? 'collapsed' : ''}`} id="consoleSection">
        <div className="console-header">
           <div className="console-title">Console</div>
        </div>
        <div className="console-box" id="consoleBox" ref={consoleBoxRef}>
             <div id="status" className="console-text">{status}</div>
        </div>
      </div>
  );
};
export default Console;
