import React, { useState, useEffect } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { Tabs, Tab, TabTitleText } from "@patternfly/react-core/dist/esm/components/Tabs";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { FormHelper } from 'cockpit-components-form-helper.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';

function ZvolPropertiesDialog({ zvol, onRefresh }) {
    const Dialogs = useDialogs();
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [properties, setProperties] = useState({});
    const [formValues, setFormValues] = useState({});
    const [error, setError] = useState({});

    useEffect(() => {
        loadProperties();
    }, [zvol.name]);

    const loadProperties = async () => {
        setLoading(true);
        try {
            const props = await ZfsApi.getDatasetProperties(zvol.name);
            setProperties(props);
            
            // Initialize form values with current property values
            setFormValues({
                volsize: props.volsize?.value || '',
                volblocksize: props.volblocksize?.value || '8K',
                compression: props.compression?.value || 'off',
                dedup: props.dedup?.value || 'off',
            });
        } catch (exc) {
            setError({
                dialogError: 'Failed to load ZVOL properties',
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
            
            // Volume size
            if (formValues.volsize && formValues.volsize.trim() !== properties.volsize?.value) {
                updates.push(ZfsApi.setDatasetProperty(zvol.name, 'volsize', formValues.volsize.trim()));
            }
            
            // Block size
            if (formValues.volblocksize !== properties.volblocksize?.value) {
                updates.push(ZfsApi.setDatasetProperty(zvol.name, 'volblocksize', formValues.volblocksize));
            }
            
            // Compression
            if (formValues.compression !== properties.compression?.value) {
                updates.push(ZfsApi.setDatasetProperty(zvol.name, 'compression', formValues.compression));
            }
            
            // Deduplication
            if (formValues.dedup !== properties.dedup?.value) {
                updates.push(ZfsApi.setDatasetProperty(zvol.name, 'dedup', formValues.dedup));
            }
            
            await Promise.all(updates);
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: 'Failed to save ZVOL properties',
                dialogErrorDetail: exc.message || String(exc)
            });
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Modal position="top" variant="medium" isOpen onClose={Dialogs.close}>
                <ModalBody>
                    <Spinner size="lg" aria-label="Loading properties" />
                </ModalBody>
            </Modal>
        );
    }

    return (
        <Modal position="top" variant="large" isOpen onClose={Dialogs.close}>
            <ModalHeader title={`ZVOL Properties: ${zvol.name}`} />
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
                        onSelect={(_, key) => setActiveTab(key)}
                    >
                        <Tab eventKey={0} title={<TabTitleText>General</TabTitleText>}>
                            <div style={{ paddingTop: 'var(--pf-t--global--spacer--md)' }}>
                                <FormGroup label="Volume Size" fieldId="volsize">
                                    <TextInput
                                        id="volsize"
                                        value={formValues.volsize}
                                        onChange={(_, value) => setFormValues({ ...formValues, volsize: value })}
                                        placeholder="e.g., 10G, 1T"
                                    />
                                    <FormHelper helperText="Current size: {properties.volsize?.value || '-'}. Enter new size to resize the volume." />
                                </FormGroup>

                                <FormGroup label="Block Size" fieldId="volblocksize">
                                    <FormSelect
                                        id="volblocksize"
                                        value={formValues.volblocksize}
                                        onChange={(_, value) => setFormValues({ ...formValues, volblocksize: value })}
                                    >
                                        <FormSelectOption value="512" label="512 bytes" />
                                        <FormSelectOption value="1K" label="1 KB" />
                                        <FormSelectOption value="2K" label="2 KB" />
                                        <FormSelectOption value="4K" label="4 KB" />
                                        <FormSelectOption value="8K" label="8 KB" />
                                        <FormSelectOption value="16K" label="16 KB" />
                                        <FormSelectOption value="32K" label="32 KB" />
                                        <FormSelectOption value="64K" label="64 KB" />
                                        <FormSelectOption value="128K" label="128 KB" />
                                    </FormSelect>
                                    <FormHelper helperText="Block size affects performance. Cannot be changed after creation." />
                                </FormGroup>

                                <FormGroup label="Compression" fieldId="compression">
                                    <FormSelect
                                        id="compression"
                                        value={formValues.compression}
                                        onChange={(_, value) => setFormValues({ ...formValues, compression: value })}
                                    >
                                        <FormSelectOption value="off" label="Off" />
                                        <FormSelectOption value="lz4" label="lz4 (fast, recommended)" />
                                        <FormSelectOption value="gzip" label="gzip (balanced)" />
                                        <FormSelectOption value="gzip-1" label="gzip-1 (fastest)" />
                                        <FormSelectOption value="gzip-9" label="gzip-9 (best compression)" />
                                        <FormSelectOption value="zstd" label="zstd (modern, efficient)" />
                                        <FormSelectOption value="zstd-fast" label="zstd-fast (faster zstd)" />
                                    </FormSelect>
                                </FormGroup>

                                <FormGroup label="Deduplication" fieldId="dedup">
                                    <FormSelect
                                        id="dedup"
                                        value={formValues.dedup}
                                        onChange={(_, value) => setFormValues({ ...formValues, dedup: value })}
                                    >
                                        <FormSelectOption value="off" label="Off" />
                                        <FormSelectOption value="on" label="On" />
                                        <FormSelectOption value="verify" label="Verify" />
                                    </FormSelect>
                                    <FormHelper helperText="Deduplication requires significant RAM. Use only if you have sufficient memory." />
                                </FormGroup>
                            </div>
                        </Tab>
                    </Tabs>
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    id="save-zvol-properties"
                    onClick={handleSave}
                    isDisabled={saving}
                    isLoading={saving}
                >
                    Save
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={saving}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default ZvolPropertiesDialog;

