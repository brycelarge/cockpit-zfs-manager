import React, { useState, useEffect } from 'react';

import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { Tabs, Tab, TabTitleText } from "@patternfly/react-core/dist/esm/components/Tabs";
import { Tooltip } from "@patternfly/react-core/dist/esm/components/Tooltip";
import { HelpIcon } from '@patternfly/react-icons';

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';
import { ZfsApi } from '../../zfsApi/index.js';

function DatasetPropertiesDialog({ filesystem, onRefresh }) {
    const Dialogs = useDialogs();
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [properties, setProperties] = useState({});
    const [formValues, setFormValues] = useState({});
    const [error, setError] = useState({});

    useEffect(() => {
        loadProperties();
    }, [filesystem.name]);

    const loadProperties = async () => {
        setLoading(true);
        try {
            const props = await ZfsApi.getDatasetProperties(filesystem.name);
            setProperties(props);
            
            // Initialize form values with current property values
            setFormValues({
                compression: props.compression?.value || 'off',
                dedup: props.dedup?.value || 'off',
                quota: props.quota?.value === 'none' ? '' : props.quota?.value || '',
                reservation: props.reservation?.value === 'none' ? '' : props.reservation?.value || '',
                atime: props.atime?.value === 'on',
                sync: props.sync?.value || 'standard',
                recordsize: props.recordsize?.value || '128K',
                readonly: props.readonly?.value === 'on',
                exec: props.exec?.value === 'on',
                setuid: props.setuid?.value === 'on',
                canmount: props.canmount?.value || 'on',
                mountpoint: props.mountpoint?.value || 'default'
            });
        } catch (exc) {
            setError({
                dialogError: 'Failed to load dataset properties',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError({});

        try {
            const updates = [];
            
            // Compression
            if (formValues.compression !== properties.compression?.value) {
                updates.push(ZfsApi.setDatasetProperty(filesystem.name, 'compression', formValues.compression));
            }
            
            // Deduplication
            if (formValues.dedup !== properties.dedup?.value) {
                updates.push(ZfsApi.setDatasetProperty(filesystem.name, 'dedup', formValues.dedup));
            }
            
            // Quota
            const quotaValue = formValues.quota.trim() || 'none';
            if (quotaValue !== (properties.quota?.value || 'none')) {
                updates.push(ZfsApi.setDatasetProperty(filesystem.name, 'quota', quotaValue));
            }
            
            // Reservation
            const reservationValue = formValues.reservation.trim() || 'none';
            if (reservationValue !== (properties.reservation?.value || 'none')) {
                updates.push(ZfsApi.setDatasetProperty(filesystem.name, 'reservation', reservationValue));
            }
            
            // Atime
            const atimeValue = formValues.atime ? 'on' : 'off';
            if (atimeValue !== properties.atime?.value) {
                updates.push(ZfsApi.setDatasetProperty(filesystem.name, 'atime', atimeValue));
            }
            
            // Sync
            if (formValues.sync !== properties.sync?.value) {
                updates.push(ZfsApi.setDatasetProperty(filesystem.name, 'sync', formValues.sync));
            }
            
            // Recordsize
            if (formValues.recordsize !== properties.recordsize?.value) {
                updates.push(ZfsApi.setDatasetProperty(filesystem.name, 'recordsize', formValues.recordsize));
            }
            
            // Readonly
            const readonlyValue = formValues.readonly ? 'on' : 'off';
            if (readonlyValue !== properties.readonly?.value) {
                updates.push(ZfsApi.setDatasetProperty(filesystem.name, 'readonly', readonlyValue));
            }
            
            // Exec
            const execValue = formValues.exec ? 'on' : 'off';
            if (execValue !== properties.exec?.value) {
                updates.push(ZfsApi.setDatasetProperty(filesystem.name, 'exec', execValue));
            }
            
            // Setuid
            const setuidValue = formValues.setuid ? 'on' : 'off';
            if (setuidValue !== properties.setuid?.value) {
                updates.push(ZfsApi.setDatasetProperty(filesystem.name, 'setuid', setuidValue));
            }
            
            // Canmount
            if (formValues.canmount !== properties.canmount?.value) {
                updates.push(ZfsApi.setDatasetProperty(filesystem.name, 'canmount', formValues.canmount));
            }
            
            // Mountpoint
            if (formValues.mountpoint !== properties.mountpoint?.value) {
                updates.push(ZfsApi.setDatasetProperty(filesystem.name, 'mountpoint', formValues.mountpoint));
            }

            await Promise.all(updates);
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: 'Failed to save properties',
                dialogErrorDetail: exc.message || String(exc)
            });
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Modal position="top" variant="large" isOpen onClose={Dialogs.close}>
                <ModalHeader title={`Properties: ${filesystem.name}`} />
                <ModalBody>
                    <Spinner size="lg" aria-label="Loading properties" />
                </ModalBody>
            </Modal>
        );
    }

    return (
        <Modal position="top" variant="large" isOpen onClose={Dialogs.close}>
            <ModalHeader title={`Properties: ${filesystem.name}`} />
            <ModalBody>
                <Form isHorizontal>
                    {error.dialogError && (
                        <ModalError
                            dialogError={error.dialogError}
                            {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                        />
                    )}

                    <Tabs
                        activeKey={activeTab}
                        onSelect={(_, tabIndex) => setActiveTab(tabIndex)}
                    >
                        <Tab eventKey={0} title={<TabTitleText>General</TabTitleText>}>
                            <div style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
                                <FormGroup
                                    label={
                                        <span>
                                            Compression
                                            <Tooltip content="Compression algorithm to use. Reduces storage usage at the cost of CPU.">
                                                <span style={{ marginLeft: 'var(--pf-t--global--spacer--xs)' }}>
                                                    <HelpIcon />
                                                </span>
                                            </Tooltip>
                                        </span>
                                    }
                                    fieldId="compression"
                                >
                                    <FormSelect
                                        id="compression"
                                        value={formValues.compression}
                                        onChange={(_, value) => setFormValues({ ...formValues, compression: value })}
                                    >
                                        <FormSelectOption value="off" label="Off" />
                                        <FormSelectOption value="on" label="On (lzjb)" />
                                        <FormSelectOption value="lzjb" label="LZJB" />
                                        <FormSelectOption value="gzip" label="GZIP" />
                                        <FormSelectOption value="gzip-1" label="GZIP-1 (fastest)" />
                                        <FormSelectOption value="gzip-9" label="GZIP-9 (best compression)" />
                                        <FormSelectOption value="zle" label="ZLE" />
                                        <FormSelectOption value="lz4" label="LZ4 (recommended)" />
                                        <FormSelectOption value="zstd" label="ZSTD" />
                                        <FormSelectOption value="zstd-fast" label="ZSTD-Fast" />
                                    </FormSelect>
                                </FormGroup>

                                <FormGroup
                                    label={
                                        <span>
                                            Deduplication
                                            <Tooltip content="Enable data deduplication. Requires significant RAM and CPU resources.">
                                                <span style={{ marginLeft: 'var(--pf-t--global--spacer--xs)' }}>
                                                    <HelpIcon />
                                                </span>
                                            </Tooltip>
                                        </span>
                                    }
                                    fieldId="dedup"
                                >
                                    <FormSelect
                                        id="dedup"
                                        value={formValues.dedup}
                                        onChange={(_, value) => setFormValues({ ...formValues, dedup: value })}
                                    >
                                        <FormSelectOption value="off" label="Off" />
                                        <FormSelectOption value="on" label="On" />
                                        <FormSelectOption value="verify" label="Verify" />
                                        <FormSelectOption value="sha256" label="SHA256" />
                                        <FormSelectOption value="sha256,verify" label="SHA256,Verify" />
                                    </FormSelect>
                                </FormGroup>

                                <FormGroup
                                    label={
                                        <span>
                                            Access Time (atime)
                                            <Tooltip content="Update access time when files are read. Disabling improves performance.">
                                                <span style={{ marginLeft: 'var(--pf-t--global--spacer--xs)' }}>
                                                    <HelpIcon />
                                                </span>
                                            </Tooltip>
                                        </span>
                                    }
                                    fieldId="atime"
                                >
                                    <Checkbox
                                        id="atime"
                                        label="Update access time on read"
                                        isChecked={formValues.atime}
                                        onChange={(_, checked) => setFormValues({ ...formValues, atime: checked })}
                                    />
                                </FormGroup>

                                <FormGroup
                                    label={
                                        <span>
                                            Sync
                                            <Tooltip content="Controls how synchronous write requests are handled.">
                                                <span style={{ marginLeft: 'var(--pf-t--global--spacer--xs)' }}>
                                                    <HelpIcon />
                                                </span>
                                            </Tooltip>
                                        </span>
                                    }
                                    fieldId="sync"
                                >
                                    <FormSelect
                                        id="sync"
                                        value={formValues.sync}
                                        onChange={(_, value) => setFormValues({ ...formValues, sync: value })}
                                    >
                                        <FormSelectOption value="standard" label="Standard" />
                                        <FormSelectOption value="always" label="Always" />
                                        <FormSelectOption value="disabled" label="Disabled" />
                                    </FormSelect>
                                </FormGroup>

                                <FormGroup
                                    label={
                                        <span>
                                            Record Size
                                            <Tooltip content="Suggested block size for files. Larger values improve sequential performance but reduce random I/O performance.">
                                                <span style={{ marginLeft: 'var(--pf-t--global--spacer--xs)' }}>
                                                    <HelpIcon />
                                                </span>
                                            </Tooltip>
                                        </span>
                                    }
                                    fieldId="recordsize"
                                >
                                    <FormSelect
                                        id="recordsize"
                                        value={formValues.recordsize}
                                        onChange={(_, value) => setFormValues({ ...formValues, recordsize: value })}
                                    >
                                        <FormSelectOption value="512" label="512 bytes" />
                                        <FormSelectOption value="1K" label="1 KB" />
                                        <FormSelectOption value="2K" label="2 KB" />
                                        <FormSelectOption value="4K" label="4 KB" />
                                        <FormSelectOption value="8K" label="8 KB" />
                                        <FormSelectOption value="16K" label="16 KB" />
                                        <FormSelectOption value="32K" label="32 KB" />
                                        <FormSelectOption value="64K" label="64 KB" />
                                        <FormSelectOption value="128K" label="128 KB (default)" />
                                        <FormSelectOption value="256K" label="256 KB" />
                                        <FormSelectOption value="512K" label="512 KB" />
                                        <FormSelectOption value="1M" label="1 MB" />
                                    </FormSelect>
                                </FormGroup>
                            </div>
                        </Tab>

                        <Tab eventKey={1} title={<TabTitleText>Quota & Reservation</TabTitleText>}>
                            <div style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
                                <FormGroup
                                    label={
                                        <span>
                                            Quota
                                            <Tooltip content="Maximum amount of space the dataset can consume. Leave empty for unlimited.">
                                                <span style={{ marginLeft: 'var(--pf-t--global--spacer--xs)' }}>
                                                    <HelpIcon />
                                                </span>
                                            </Tooltip>
                                        </span>
                                    }
                                    fieldId="quota"
                                    helperText="Examples: 10G, 500M, 2T. Leave empty for unlimited."
                                >
                                    <TextInput
                                        id="quota"
                                        value={formValues.quota}
                                        onChange={(_, value) => setFormValues({ ...formValues, quota: value })}
                                        placeholder="none"
                                    />
                                </FormGroup>

                                <FormGroup
                                    label={
                                        <span>
                                            Reservation
                                            <Tooltip content="Guaranteed amount of space reserved for this dataset. Leave empty for none.">
                                                <span style={{ marginLeft: 'var(--pf-t--global--spacer--xs)' }}>
                                                    <HelpIcon />
                                                </span>
                                            </Tooltip>
                                        </span>
                                    }
                                    fieldId="reservation"
                                    helperText="Examples: 10G, 500M, 2T. Leave empty for none."
                                >
                                    <TextInput
                                        id="reservation"
                                        value={formValues.reservation}
                                        onChange={(_, value) => setFormValues({ ...formValues, reservation: value })}
                                        placeholder="none"
                                    />
                                </FormGroup>
                            </div>
                        </Tab>

                        <Tab eventKey={2} title={<TabTitleText>Mount Options</TabTitleText>}>
                            <div style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
                                <FormGroup
                                    label="Mount Point"
                                    fieldId="mountpoint"
                                    helperText="Directory where the dataset will be mounted. Use 'none' to prevent mounting, 'legacy' for manual mounting."
                                >
                                    <TextInput
                                        id="mountpoint"
                                        value={formValues.mountpoint}
                                        onChange={(_, value) => setFormValues({ ...formValues, mountpoint: value })}
                                        placeholder="default"
                                    />
                                </FormGroup>

                                <FormGroup
                                    label="Can Mount"
                                    fieldId="canmount"
                                >
                                    <FormSelect
                                        id="canmount"
                                        value={formValues.canmount}
                                        onChange={(_, value) => setFormValues({ ...formValues, canmount: value })}
                                    >
                                        <FormSelectOption value="on" label="On" />
                                        <FormSelectOption value="off" label="Off" />
                                        <FormSelectOption value="noauto" label="No Auto" />
                                    </FormSelect>
                                </FormGroup>

                                <FormGroup
                                    label="Read Only"
                                    fieldId="readonly"
                                >
                                    <Checkbox
                                        id="readonly"
                                        label="Make dataset read-only"
                                        isChecked={formValues.readonly}
                                        onChange={(_, checked) => setFormValues({ ...formValues, readonly: checked })}
                                    />
                                </FormGroup>

                                <FormGroup
                                    label="Execute"
                                    fieldId="exec"
                                >
                                    <Checkbox
                                        id="exec"
                                        label="Allow execution of binaries"
                                        isChecked={formValues.exec}
                                        onChange={(_, checked) => setFormValues({ ...formValues, exec: checked })}
                                    />
                                </FormGroup>

                                <FormGroup
                                    label="Set UID"
                                    fieldId="setuid"
                                >
                                    <Checkbox
                                        id="setuid"
                                        label="Allow setuid execution"
                                        isChecked={formValues.setuid}
                                        onChange={(_, checked) => setFormValues({ ...formValues, setuid: checked })}
                                    />
                                </FormGroup>
                            </div>
                        </Tab>
                    </Tabs>
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    onClick={handleSave}
                    isDisabled={saving}
                    isLoading={saving}
                >
                    Save Properties
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={saving}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default DatasetPropertiesDialog;

