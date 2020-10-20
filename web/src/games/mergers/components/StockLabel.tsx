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
    const { chain, onClick } = this.props;
    const firstLetter = chain[0];
    return (
      <div key={`stock-label-${chain}`} className={this.className()} onClick={onClick}>
        {firstLetter}
      </div>
    );
  }
}
