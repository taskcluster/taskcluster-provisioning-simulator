import React from 'react';
import Chart from 'react-chartjs-2';
import './LinearGraph.css';

const Index = (props = {}) => {
    const { title, data, LineProps = {} } = props;
    return (
        <>
            <h2>{title}</h2>
            <div className="ChartContainer">
                <Chart
                    options={{ aspectRatio: 2, maintainAspectRatio: true }}
                    type="line"
                    data={data}
                    {...LineProps}
                />
            </div>
        </>
    )
};

export default Index;