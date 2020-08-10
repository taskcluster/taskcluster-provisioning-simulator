import React from 'react';
import { hot } from 'react-hot-loader';
import analysis from '../analysis';

const Summary = () => {
    console.log(analysis.datastore);
  return (
    <>
        <h1>Summary</h1>
        {
          analysis.summaryStatistics.map(({title, value, display}) => {
            return (
              <div key={title}>
                <em>{title}:</em>{' '}{display(value)}
              </div>
            );
          })
        }
    </>
  );
};

export default hot(module)(Summary);
