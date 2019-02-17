import React from "react";

const Temperature = ({ value, unit }) => {
    return (
        <div className="temperature">
            <span>{value}</span>
            <span className="unit">{unit}</span>
        </div>
    );
};
export default Temperature;
