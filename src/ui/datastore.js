import React from 'react';
import { hot } from 'react-hot-loader';
import datastoreJson from '../../datastore';
import { DataStore } from '../';

const DataStoreContext = React.createContext(
  DataStore.fromSerializable(datastoreJson));

export default hot(module)(DataStoreContext);
