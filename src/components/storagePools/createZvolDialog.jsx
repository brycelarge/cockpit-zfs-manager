import React, { useState } from 'react';

import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { ExpandableSection } from "@patternfly/react-core/dist/esm/components/ExpandableSection";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";

import { FormHelper } from 'cockpit-components-form-helper.jsx';
import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';

function CreateZvolDialog({ pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [zvolName, setZvolName] = useState(`${pool.name}/`);
    const [size, setSize] = useState('');
    const [advancedExpanded, setAdvancedExpanded] = useState(false);
    const [volblocksize, setVolblocksize] = useState('8K');
    const [compressionEnabled, setCompressionEnabled] = useState(false);
    const [compressionType, setCompressionType] = useState('lz4');
    const [deduplicationEnabled, setDeduplicationEnabled] = useState(false);
    const [sparse, setSparse] = useState(false);
    const [validationFailed, setValidationFailed] = useState({});
    const [error, setError] = useState({});
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        const validation = {};
        const trimmedName = zvolName.trim();
        
        if (!trimmedName || !trimmedName.startsWith(`${pool.name}/`)) {
            validation.name = 'ZVOL name must start with pool name';
        } else {
            // Extract the dataset name part (after pool name)
            const datasetPart = trimmedName.substring(pool.name.length + 1);
            if (!datasetPart) {
                validation.name = 'ZVOL name cannot be empty';
            } else if (datasetPart.includes('@')) {
                validation.name = 'ZVOL name cannot contain @';
            } else if (datasetPart.includes('#')) {
                validation.name = 'ZVOL name cannot contain #';
            }
        }
        
        if (!size || size.trim() === '') {
            validation.size = 'Size is required';
        } else {
            // Validate size format (e.g., "10G", "1T", "512M")
            const sizeMatch = size.trim().match(/^([\d.]+)\s*([KMGT]i?B?)$/i);
            if (!sizeMatch) {
                validation.size = 'Invalid size format. Use format like: 10G, 1T, 512M';
            }
        }

        if (Object.keys(validation).length > 0) {
            setValidationFailed(validation);
            return;
        }

        setCreating(true);
        setError({});
        try {
            // Build properties object
            const properties = {};
            if (volblocksize) {
                properties.volblocksize = volblocksize;
            }
            if (compressionEnabled && compressionType) {
                properties.compression = compressionType;
            }
            if (deduplicationEnabled) {
                properties.deduplication = 'on';
            }
            if (sparse) {
                properties.sparse = true;
            }

            await ZfsApi.createZvol(trimmedName, size.trim(), properties);
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: 'Failed to create ZVOL',
                dialogErrorDetail: exc.message || String(exc)
            });
            setCreating(false);
        }
    };

    return (
        <Modal position="top" variant="medium" isOpen onClose={Dialogs.close}>
            <ModalHeader title="Create ZVOL Volume" />
            <ModalBody>
                <Form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleCreate();
                    }}
                    isHorizontal
                >
                    {error.dialogError && (
                        <ModalError
                            dialogError={error.dialogError}
                            {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                        />
                    )}

                    <FormGroup label="ZVOL Name" fieldId="zvol-name" isRequired>
                        <TextInput
                            id="zvol-name"
                            validated={validationFailed.name ? "error" : "default"}
                            value={zvolName}
                            onChange={(_, value) => {
                                setZvolName(value);
                                if (validationFailed.name) {
                                    setValidationFailed({ ...validationFailed, name: undefined });
                                }
                            }}
                            placeholder={`${pool.name}/`}
                        />
                        <FormHelper
                            helperText="Enter the name for the ZVOL volume"
                            helperTextInvalid={validationFailed.name}
                        />
                    </FormGroup>

                    <FormGroup label="Size" fieldId="zvol-size" isRequired>
                        <TextInput
                            id="zvol-size"
                            validated={validationFailed.size ? "error" : "default"}
                            value={size}
                            onChange={(_, value) => {
                                setSize(value);
                                if (validationFailed.size) {
                                    setValidationFailed({ ...validationFailed, size: undefined });
                                }
                            }}
                            placeholder="e.g., 10G, 1T, 512M"
                        />
                        <FormHelper
                            helperText="Enter the size of the ZVOL volume (e.g., 10G, 1T, 512M)"
                            helperTextInvalid={validationFailed.size}
                        />
                    </FormGroup>

                    <ExpandableSection
                        toggleText="Advanced Options"
                        onToggle={(_, isExpanded) => setAdvancedExpanded(isExpanded)}
                        isExpanded={advancedExpanded}
                    >
                        <FormGroup label="Block Size" fieldId="volblocksize">
                            <FormSelect
                                id="volblocksize"
                                value={volblocksize}
                                onChange={(_, value) => setVolblocksize(value)}
                            >
                                <FormSelectOption value="512" label="512 bytes" />
                                <FormSelectOption value="1K" label="1 KB" />
                                <FormSelectOption value="2K" label="2 KB" />
                                <FormSelectOption value="4K" label="4 KB" />
                                <FormSelectOption value="8K" label="8 KB (default)" />
                                <FormSelectOption value="16K" label="16 KB" />
                                <FormSelectOption value="32K" label="32 KB" />
                                <FormSelectOption value="64K" label="64 KB" />
                                <FormSelectOption value="128K" label="128 KB" />
                            </FormSelect>
                            <FormHelper helperText="Block size affects performance. Smaller blocks use more metadata but may improve space efficiency." />
                        </FormGroup>

                        <FormGroup fieldId="compression">
                            <Checkbox
                                id="compression-enabled"
                                label="Enable compression"
                                isChecked={compressionEnabled}
                                onChange={(_, checked) => setCompressionEnabled(checked)}
                            />
                            {compressionEnabled && (
                                <FormSelect
                                    id="compression-type"
                                    value={compressionType}
                                    onChange={(_, value) => setCompressionType(value)}
                                    style={{ marginTop: 'var(--pf-t--global--spacer--sm)' }}
                                >
                                    <FormSelectOption value="lz4" label="lz4 (fast, recommended)" />
                                    <FormSelectOption value="gzip" label="gzip (balanced)" />
                                    <FormSelectOption value="gzip-1" label="gzip-1 (fastest compression)" />
                                    <FormSelectOption value="gzip-9" label="gzip-9 (best compression)" />
                                    <FormSelectOption value="zstd" label="zstd (modern, efficient)" />
                                    <FormSelectOption value="zstd-fast" label="zstd-fast (faster zstd)" />
                                </FormSelect>
                            )}
                        </FormGroup>

                        <FormGroup fieldId="deduplication">
                            <Checkbox
                                id="deduplication-enabled"
                                label="Enable deduplication"
                                isChecked={deduplicationEnabled}
                                onChange={(_, checked) => setDeduplicationEnabled(checked)}
                            />
                            <div style={{ marginTop: 'var(--pf-t--global--spacer--sm)', fontSize: 'var(--pf-t--global--font--size--sm)', color: 'var(--pf-t--global--text--color--muted)' }}>
                                Deduplication requires significant RAM. Use only if you have sufficient memory.
                            </div>
                        </FormGroup>

                        <FormGroup fieldId="sparse">
                            <Checkbox
                                id="sparse-zvol"
                                label="Create sparse volume (thin provisioning)"
                                isChecked={sparse}
                                onChange={(_, checked) => setSparse(checked)}
                            />
                            <div style={{ marginTop: 'var(--pf-t--global--spacer--sm)', fontSize: 'var(--pf-t--global--font--size--sm)', color: 'var(--pf-t--global--text--color--muted)' }}>
                                Sparse volumes allocate space on-demand rather than reserving the full size upfront.
                            </div>
                        </FormGroup>
                    </ExpandableSection>
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    id="create-zvol-dialog-confirm"
                    onClick={handleCreate}
                    isDisabled={creating}
                    isLoading={creating}
                >
                    Create ZVOL
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={creating}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default CreateZvolDialog;

