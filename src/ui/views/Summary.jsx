import React from 'react';
import { Link } from "react-router-dom";
import { hot } from 'react-hot-loader';
import analysis from '../analysis';

const statistics = [];


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
