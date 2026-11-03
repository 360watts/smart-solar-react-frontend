import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SlaveEditDialog from '../SlaveEditDialog';
import { blankRegister } from '../slaveForm';

const reg = (id: number, label: string, address: number) => ({ ...blankRegister(), id, label, address });
const initial = {
  slave_id: '1', device_name: 'Deye inverter', polling_interval_ms: 5000, timeout_ms: 1000, priority: 1, enabled: true,
  registers: [reg(1, 'Battery SOC', 184), reg(2, 'Grid power', 169)],
};

const setup = (over: any = {}) => {
  const onSave = jest.fn();
  const onCancel = jest.fn();
  render(
    <SlaveEditDialog open editingSlave={{ id: 1, slaveId: 1, deviceName: 'Deye inverter' }} existingSlaveIds={[]}
      initialForm={initial} onSave={onSave} onCancel={onCancel} {...over} />,
  );
  return { onSave, onCancel };
};

describe('SlaveEditDialog', () => {
  it('E8 shows the slave being edited', () => {
    setup();
    expect(screen.getByText('Edit slave')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Deye inverter')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Battery SOC')).toBeInTheDocument();
  });

  it('E9 a bad timeout shows a message and does not save', () => {
    const { onSave } = setup();
    fireEvent.change(screen.getByLabelText(/Reply timeout/), { target: { value: '6000' } });
    fireEvent.click(screen.getByText('Save slave'));
    expect(screen.getByText(/Must be shorter than the poll interval/)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('E10 a valid form is saved', () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByText('Save slave'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ slave_id: '1', priority: 1 }));
  });

  it('E11 the chevron opens the advanced fields', () => {
    setup();
    expect(screen.queryByText('Byte order')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Show advanced fields for Battery SOC'));
    expect(screen.getByText('Byte order')).toBeInTheDocument();
    expect(screen.getByText('Offset')).toBeInTheDocument();
  });

  it('E12 removing a register drops its row', () => {
    setup();
    fireEvent.click(screen.getByLabelText('Show advanced fields for Battery SOC'));
    fireEvent.click(screen.getByText('Remove register'));
    expect(screen.queryByDisplayValue('Battery SOC')).not.toBeInTheDocument();
    expect(screen.getByText(/\(1 on of 1\)/)).toBeInTheDocument();
  });

  it('E13 adding a register opens a new row after the highest address', () => {
    setup();
    fireEvent.click(screen.getByText('Add register'));
    expect(screen.getByText(/\(3 on of 3\)/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('185')).toBeInTheDocument();
  });

  it('E14 search narrows the registers', () => {
    setup();
    fireEvent.change(screen.getByLabelText('Search registers'), { target: { value: 'grid' } });
    expect(screen.queryByDisplayValue('Battery SOC')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Grid power')).toBeInTheDocument();
  });
});
