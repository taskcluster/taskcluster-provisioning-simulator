import React from 'react';
import { hot } from 'react-hot-loader';
import LinearGraph from '../Components/LinearGraph';
import analysis from '../analysis';

const PointInTimeMetrics = () => {
    const events = analysis.datastore.events;
    const timeAnalysis = new Map();
    const state = {
        runningTasks: 0,
        pendingTasks: 0,
        resolvedTasks: 0,
        runningWorkers: 0,
        requestedWorkers: 0,
        shutdownWorkers: 0,
    };
    const datasetDefaults = {
        fill: false,
        pointRadius: 1,
    };

    const updateState = (event) => {
        const [eventTime, eventType] = event;

        switch (eventType) {
            case 'task-created': {
                state.pendingTasks += 1;
                break;
            }

            case 'task-started': {
                state.runningTasks += 1;
                state.pendingTasks -= 1;
                break;
            }

            case 'task-resolved': {
                state.runningTasks -= 1;
                state.resolvedTasks += 1;
                break;
            }

            case 'worker-requested': {
                state.requestedWorkers += 1;
                break;
            }

            case 'worker-started': {
                state.requestedWorkers -= 1;
                state.runningWorkers += 1;
                break;
            }

            case 'worker-shutdown': {
                state.runningWorkers -= 1;
                state.shutdownWorkers += 1;
                break;
            }
        }

        timeAnalysis.set(eventTime, { ...state });
    };

    events.forEach(updateState);

    const tasks = {
        labels: events.map(e => e[0]),
        datasets: [
            {
                ...datasetDefaults,
                label: 'Running Tasks',
                backgroundColor: 'blue',
                borderColor: 'blue',
                data: [...timeAnalysis.values()].map(({ runningTasks }) => runningTasks),
            },
            {
                ...datasetDefaults,
                label: 'Pending Tasks',
                backgroundColor: 'grey',
                borderColor: 'grey',
                fill: false,
                data: [...timeAnalysis.values()].map(({ pendingTasks }) => pendingTasks),
            },
            {
                ...datasetDefaults,
                label: 'Resolved Tasks',
                backgroundColor: 'green',
                borderColor: 'green',
                fill: false,
                data: [...timeAnalysis.values()].map(({ resolvedTasks }) => resolvedTasks),
            },
        ]
    };
    const workers = {
        labels: events.map(e => e[0]),
        datasets: [
            {
                ...datasetDefaults,
                label: 'Running Workers',
                backgroundColor: 'blue',
                borderColor: 'blue',
                data: [...timeAnalysis.values()].map(({ runningWorkers }) => runningWorkers),
            },
            {
                ...datasetDefaults,
                label: 'Requested Workers',
                backgroundColor: 'grey',
                borderColor: 'grey',
                fill: false,
                data: [...timeAnalysis.values()].map(({ requestedWorkers }) => requestedWorkers),
            },
            {
                ...datasetDefaults,
                label: 'Shutdown Workers',
                backgroundColor: 'green',
                borderColor: 'green',
                fill: false,
                data: [...timeAnalysis.values()].map(({ shutdownWorkers }) => shutdownWorkers),
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
