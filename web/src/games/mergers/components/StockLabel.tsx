import React from 'react';
import { Chain } from '../types';

import css from './StockLabel.css';

interface StockLabelProps {
  chain: Chain;
  onClick?: () => void;
}

export class StockLabel extends React.Component<StockLabelProps, {}> {
  constructor(props: StockLabelProps) {
    super(props);
  }

  className() {
    let className = `${css.StockLabel} ${css[this.props.chain]}`;
    if (this.props.onClick) {
      className += ` ${css.Clickable}`;
    }
    return className;
  }

  render() {
    return (
      <div key={`stock-label-${this.props.chain}`} className={this.className()} onClick={this.props.onClick}>
        {this.props.chain[0]}
      </div>
    );
  }
}
