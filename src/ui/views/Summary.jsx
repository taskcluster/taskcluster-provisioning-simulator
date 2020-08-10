import React from 'react';
import { hot } from 'react-hot-loader';
import analysis from '../analysis';

const Summary = () => {
  return (
    <>{
      analysis.summaryStatistics.map(({title, value, display}) => {
        return (
          <div key={title}>
            <em>{title}:</em>{' '}{display(value)}
          </div>
        );
      })
    }</>
  );
};

export default hot(module)(Summary);
