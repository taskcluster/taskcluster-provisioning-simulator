import React from 'react';
import { Link } from "react-router-dom";
import { hot } from 'react-hot-loader';
import DataStoreContext from '../datastore';

const statistics = [];

statistics.push({
  title: 'Number of Events',
  description: 'Total number of simulation events during the simulation phase, including contextual events.',
  calculate(datastore) {
    return datastore.events.length;
  }
});

statistics.push({
  title: 'Simulation Duration',
  description: 'Total duration of the simulation phase.',
  calculate(datastore) {
    return `${datastore.duration}ms`;
  }
});

statistics.push({
  title: 'Overprovisioned Workers',
  description: 'Number of workers that started up, did no work, and shut down again.',
  calculate(datastore) {
    const overProvisioned = new Set();
    for (let [time, evt, ...rest] of datastore.events) {
      switch (evt) {
        case 'worker-started': {
          overProvisioned.add(rest[0]);
          break;
        }
        case 'task-started': {
          overProvisioned.delete(rest[1]);
          break;
        }
      }
    }

    return `${overProvisioned.size} workers`;
  }
});

const Summary = () => {
  const ds = React.useContext(DataStoreContext);
  return (
    <>{
      statistics.map(({title, calculate}) => {
        const value = React.useMemo(() => calculate(ds), [ds]);
        return (
          <div key={title}>
            <em>{title}:</em>{' '}{value}
          </div>
        );
      })
    }</>
  );
};

export default hot(module)(Summary);
