import React from 'react';
import { hot } from 'react-hot-loader';
import LinearGraph from '../Components/LinearGraph';
import analysis from '../analysis';
import { DataStore } from '../../datastore';

const PointInTimeMetrics = () => {
    const result = analysis.analyze({
        interval: 1000,
        metrics: {
            pendingTasks: DataStore.pendingTasks,
            runningTasks: DataStore.runningTasks,
            resolvedTasks: DataStore.resolvedTasks,
            requestedWorkers: DataStore.requestedWorkers,
            runningWorkers: DataStore.runningWorkers,
            shutdownWorkers: DataStore.shutdownWorkers,
        },
    });
    const datasetDefaults = {
        fill: false,
        pointRadius: 1,
    };
    const tasks = {
        labels: result.metrics.map(m => m.time),
        datasets: [
            {
                ...datasetDefaults,
                label: 'Running Tasks',
                backgroundColor: 'blue',
                borderColor: 'blue',
                data: result.metrics.map(({ runningTasks }) => runningTasks),
            },
            {
                ...datasetDefaults,
                label: 'Pending Tasks',
                backgroundColor: 'grey',
                borderColor: 'grey',
                fill: false,
                data: result.metrics.map(({ pendingTasks }) => pendingTasks),
            },
            {
                ...datasetDefaults,
                label: 'Resolved Tasks',
                backgroundColor: 'green',
                borderColor: 'green',
                fill: false,
                data: result.metrics.map(({ resolvedTasks }) => resolvedTasks),
            },
        ]
    };
    const workers = {
        labels: result.metrics.map(m => m.time),
        datasets: [
            {
                ...datasetDefaults,
                label: 'Running Workers',
                backgroundColor: 'blue',
                borderColor: 'blue',
                data: result.metrics.map(({ runningWorkers }) => runningWorkers),
            },
            {
                ...datasetDefaults,
                label: 'Requested Workers',
                backgroundColor: 'grey',
                borderColor: 'grey',
                fill: false,
                data: result.metrics.map(({ requestedWorkers }) => requestedWorkers),
            },
            {
                ...datasetDefaults,
                label: 'Shutdown Workers',
                backgroundColor: 'green',
                borderColor: 'green',
                fill: false,
                data: result.metrics.map(({ shutdownWorkers }) => shutdownWorkers),
            },
        ]
    };

    return (
        <>
            <h1>Point In Time Metrics</h1>
            <LinearGraph title="Tasks" data={tasks} />
            <LinearGraph title="Workers" data={workers} />
        </>
    );
};

export default hot(module)(PointInTimeMetrics);
