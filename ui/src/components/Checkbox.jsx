import React from 'react';
import '../styles/checkbox.css';

const Checkbox = ({ id, checked, onChange }) => {
  return (
    <label className="checkbox-wrapper" htmlFor={id}>
      <input 
        type="checkbox" 
        id={id} 
        checked={checked} 
        onChange={(e) => onChange(e.target.checked)} 
      />
      <span className="slider"></span>
    </label>
  );
};

export default Checkbox;
