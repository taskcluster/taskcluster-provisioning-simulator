import { hot } from 'react-hot-loader';
import React from 'react';
import './App.css';
import datastoreJson from '../../datastore';
import { DataStore } from '../';

const datastore = DataStore.fromSerializable(datastoreJson);

const message = 'Welcome to Provisioning Simulator';
const App = () => {
  return (
      <div className="App">
          <h1>{message}</h1>
          Events: {datastore.events.length}
          <br />
          Duration: {datastore.duration}
      </div>
  );
};

export default hot(module)(App);
