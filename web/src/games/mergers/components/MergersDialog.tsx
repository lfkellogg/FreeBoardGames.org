import * as React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@material-ui/core';
import Paper, { PaperProps } from '@material-ui/core/Paper';
import Draggable from 'react-draggable';

import css from '../Board.css';

export interface MergersDialogProps {
  dialogId: string;
  title: string;
  closeButtonText: string;
  onClose: () => void;
  children: React.ReactNode;
}

// TODO: use this for the other dialogs
export class MergersDialog extends React.Component<MergersDialogProps> {
  constructor(props: MergersDialogProps) {
    super(props);
  }

  createId(suffix: string): string {
    return `${this.props.dialogId}-${suffix}`;
  }

  createPaperComponent(handle: string) {
    return (props: PaperProps) => (
      <Draggable handle={handle} cancel={'[class*="MuiDialogContent-root"]'}>
        <Paper {...props} />
      </Draggable>
    );
  }

  render() {
    return (
      <Dialog
        id={this.props.dialogId}
        className={css.Mergers}
        onClose={this.props.onClose}
        PaperComponent={this.createPaperComponent(this.createId('title'))}
        aria-labelledby={this.createId('title')}
        open
      >
        <DialogTitle id={this.createId('title')} style={{ cursor: 'move' }}>
          {this.props.title}
        </DialogTitle>
        <DialogContent>{this.props.children}</DialogContent>
        <DialogActions>
          <Button id={this.createId('close')} onClick={this.props.onClose} color="primary" autoFocus>
            {this.props.closeButtonText}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
}
