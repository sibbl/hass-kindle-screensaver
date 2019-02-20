import React from 'react';

const BatteryIndicator = ({batteryLevel}) => {
    return <div className="battery" style={{ width: batteryLevel + "%" }} />;
}
export default BatteryIndicator;