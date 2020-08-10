import React from 'react';
import { Link } from "react-router-dom";
import { hot } from 'react-hot-loader';

const Home = () => {
  return (
    <ul>
      <li><Link to="/summary">Summary Statistics</Link></li>
      <li><Link to="/point-in-time-metrics">Point in Time Metrics</Link></li>
    </ul>
  );
};

export default hot(module)(Home);
