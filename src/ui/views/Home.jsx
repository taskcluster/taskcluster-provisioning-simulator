import React from 'react';
import { Link } from "react-router-dom";
import { hot } from 'react-hot-loader';

const Home = () => {
  return (
    <ul>
      <li><Link to="/summary">Summary Statistics</Link></li>
    </ul>
  );
};

export default hot(module)(Home);
