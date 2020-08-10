import { hot } from 'react-hot-loader';
import {
  BrowserRouter as Router,
  Switch,
  Route,
} from "react-router-dom";
import React from 'react';
import './App.css';
import Home from './views/Home';
import Summary from './views/Summary';
import PointInTimeMetrics from './views/PointInTimeMetrics';

const App = () => {
  return (
    <Router>
      <div className="App">
        <Switch>
          <Route path="/point-in-time-metrics">
            <PointInTimeMetrics />
          </Route>
          <Route path="/summary">
            <Summary />
          </Route>
          <Route path="/">
            <Home />
          </Route>
        </Switch>
      </div>
    </Router>
  );
};

export default hot(module)(App);
