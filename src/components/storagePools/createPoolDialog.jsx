import React, { useState } from 'react';

import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";
import { Tooltip } from "@patternfly/react-core/dist/esm/components/Tooltip";
import { Popover } from "@patternfly/react-core/dist/esm/components/Popover";
import { HelpIcon } from '@patternfly/react-icons';

import { FormHelper } from 'cockpit-components-form-helper.jsx';
import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { ZfsApi } from '../../zfsApi/index.js';

function CreatePoolDialog({ isOpen, onClose, onCreate }) {
    const [poolName, setPoolName] = useState('');
    const [vdevType, setVdevType] = useState('stripe');
    const [devices, setDevices] = useState([]);
    const [availableDisks, setAvailableDisks] = useState([]);
    const [loadingDisks, setLoadingDisks] = useState(false);
    const [creating, setCreating] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [force, setForce] = useState(false);
    const [ashift, setAshift] = useState('');
    const [validationFailed, setValidationFailed] = useState({});
    const [error, setError] = useState({});

    React.useEffect(() => {
        if (isOpen) {
            // Reset state when dialog opens
            setPoolName('');
            setVdevType('stripe');
            setDevices([]);
            setValidationFailed({});
            setError({});
            setCreating(false);
            setShowConfirm(false);
            setConfirmText('');
            setForce(false);
            setAshift('');
            loadDisks();
        }
    }, [isOpen]);

    // Auto-detect best ashift when devices change
    React.useEffect(() => {
        if (devices.length === 0) {
            setAshift('');
            return;
        }

        let maxPhySec = 512;
        devices.forEach(path => {
            const disk = availableDisks.find(d => d.path === path);
            if (disk && disk.phySec) {
                if (disk.phySec > maxPhySec) maxPhySec = disk.phySec;
            }
        });

        // Calculate optimal ashift: log2(phySec)
        // 512 -> 9, 4096 -> 12
        const optimal = Math.floor(Math.log2(maxPhySec));
        // Default to 12 if optimal is less than 12 (modern standard),
        // or stick to detected if strictly following hardware?
        // Request says "determine the best ashift".
        // ZFS best practice is often 12 even for 512n drives to allow future replacement.
        // But let's stick to the hardware detection for the "Auto" behavior logic,
        // or maybe default to 12 if 9 is detected?
        // Let's use the detected value.
        setAshift(optimal.toString());
    }, [devices, availableDisks]);

    const loadDisks = async () => {
        setLoadingDisks(true);
        try {
            const disks = await ZfsApi.listAvailableDisks();
            setAvailableDisks(disks);
            if (disks.length === 0) {
                console.warn('No disks found. Make sure lsblk is installed and you have permissions to list block devices.');
            }
        } catch (error) {
            console.error('Failed to load disks:', error);
            setError({
                dialogError: 'Failed to load available disks',
                dialogErrorDetail: error.message || String(error)
            });
        } finally {
            setLoadingDisks(false);
        }
    };

    const handleDeviceToggle = (devicePath, checked) => {
        if (checked) {
            setDevices([...devices, devicePath]);
        } else {
            setDevices(devices.filter(d => d !== devicePath));
        }
    };

    const handleCreate = () => {
        const validation = {};
        const trimmedName = poolName.trim();

        if (!trimmedName) {
            validation.name = 'Pool name is required';
        } else {
            // ZFS pool names must start with a letter and contain only alphanumeric characters, underscores, hyphens, and colons
            if (!/^[a-zA-Z]/.test(trimmedName)) {
                validation.name = 'Pool name must start with a letter';
            } else if (!/^[a-zA-Z0-9_\-:]+$/.test(trimmedName)) {
                validation.name = 'Pool name can only contain letters, numbers, underscores, hyphens, and colons';
            } else if (trimmedName.length > 255) {
                validation.name = 'Pool name must be 255 characters or less';
            }
        }

        if (devices.length === 0) {
            validation.devices = 'Please select at least one device';
        }
        if (vdevType === 'mirror' && devices.length < 2) {
            validation.devices = 'Mirror requires at least 2 devices';
        }
        if (vdevType === 'raid10' && devices.length < 4) {
            validation.devices = 'RAID 10 requires at least 4 devices';
        }
        if (vdevType === 'raid10' && devices.length % 2 !== 0) {
            validation.devices = 'RAID 10 requires an even number of devices';
        }
        if (vdevType === 'raidz' && devices.length < 3) {
            validation.devices = 'RAID-Z requires at least 3 devices';
        }
        if (vdevType === 'raidz2' && devices.length < 4) {
            validation.devices = 'RAID-Z2 requires at least 4 devices';
        }
        if (vdevType === 'raidz3' && devices.length < 5) {
            validation.devices = 'RAID-Z3 requires at least 5 devices';
        }

        if (Object.keys(validation).length > 0) {
            setValidationFailed(validation);
            return;
        }

        // Show confirmation step
        setShowConfirm(true);
        setError({});
    };

    const handleConfirmCreate = async () => {
        if (confirmText.toLowerCase() !== 'yes') {
            setError({
                dialogError: 'Confirmation required',
                dialogErrorDetail: 'Please type "yes" to confirm pool creation'
            });
            return;
        }

        setCreating(true);
        setError({});

        try {
            await onCreate({
                name: poolName.trim(),
                vdevType,
                devices,
                force,
                ashift: ashift || null
            });
            onClose();
        } catch (exc) {
            // Handle cockpit error objects which have a message property
            const errorMessage = exc?.message || (typeof exc === 'string' ? exc : String(exc));
            setError({
                dialogError: 'Failed to create pool',
                dialogErrorDetail: errorMessage || 'Unknown error occurred'
            });
            setCreating(false);
        }
    };

    return (
        <Modal
            position="top"
            variant="medium"
            id="create-pool-dialog"
            isOpen={isOpen}
            onClose={onClose}
        >
            <ModalHeader title={showConfirm ? "Confirm Pool Creation" : "Create Storage Pool"} />
            <ModalBody>
                {loadingDisks ? (
                    <Spinner size="lg" />
                ) : showConfirm ? (
                    <Form isHorizontal>
                        {error.dialogError && (
                            <ModalError
                                dialogError={error.dialogError}
                                {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                            />
                        )}

                        <Alert variant="warning" title="Warning: Data Loss Risk" style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                            <p>
                                <strong>Creating this pool will destroy all existing data on the selected devices:</strong>
                            </p>
                            <ul style={{ marginTop: 'var(--pf-t--global--spacer--sm)', marginBottom: 'var(--pf-t--global--spacer--sm)' }}>
                                {devices.map(device => (
                                    <li key={device}><code>{device}</code></li>
                                ))}
                            </ul>
                            <p>
                                <strong>This action cannot be undone.</strong> All data on these devices will be permanently lost.
                            </p>
                        </Alert>

                        <FormGroup
                            label={`Type "yes" to confirm creation of pool "${poolName.trim()}"`}
                            fieldId="confirm-text"
                        >
                            <TextInput
                                id="confirm-text"
                                value={confirmText}
                                onChange={(_, value) => {
                                    setConfirmText(value);
                                    if (error.dialogError) {
                                        setError({});
                                    }
                                }}
                                placeholder="yes"
                                validated={confirmText && confirmText.toLowerCase() !== 'yes' ? 'error' : 'default'}
                            />
                        </FormGroup>

                        <Checkbox
                            id="force-create-pool"
                            label="Force creation (overwrite existing filesystems on devices)"
                            isChecked={force}
                            onChange={(_, checked) => setForce(checked)}
                        />
                        <p style={{ marginTop: 'var(--pf-t--global--spacer--sm)', fontSize: 'var(--pf-t--global--font--size--sm)', color: 'var(--pf-t--global--text--color--muted)' }}>
                            Use this if devices contain existing filesystems that you want to overwrite. This will destroy all data on the devices.
                        </p>
                    </Form>
                ) : (
                    <Form isHorizontal>
                        {error.dialogError && (
                            <ModalError
                                dialogError={error.dialogError}
                                {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                            />
                        )}
                        <FormGroup
                            label="Pool Name"
                            fieldId="pool-name"
                            validated={validationFailed.name ? 'error' : 'default'}
                        >
                            <TextInput
                                id="pool-name"
                                value={poolName}
                                onChange={(_, value) => {
                                    setPoolName(value);
                                    if (validationFailed.name) {
                                        setValidationFailed({ ...validationFailed, name: undefined });
                                    }
                                }}
                                validated={validationFailed.name ? 'error' : 'default'}
                            />
                            <FormHelper
                                fieldId="pool-name"
                                helperTextInvalid={validationFailed.name}
                            />
                        </FormGroup>

                        <FormGroup
                            label={
                                <span>
                                    VDEV Type
                                    <Tooltip content="Virtual Device (VDEV) type determines redundancy and performance characteristics">
                                        <span style={{ marginLeft: 'var(--pf-t--global--spacer--xs)' }}>
                                            <HelpIcon />
                                        </span>
                                    </Tooltip>
                                </span>
                            }
                            fieldId="pool-vdev-type"
                        >
                            <FormSelect
                                id="pool-vdev-type"
                                value={vdevType}
                                onChange={(_, value) => {
                                    setVdevType(value);
                                    if (validationFailed.devices && value !== 'mirror') {
                                        setValidationFailed({ ...validationFailed, devices: undefined });
                                    }
                                }}
                            >
                                <FormSelectOption value="stripe" label="Stripe (No redundancy)" />
                                <FormSelectOption value="mirror" label="Mirror (requires 2+ devices)" />
                                <FormSelectOption value="raid10" label="RAID 10 (Stripe of Mirrors, requires 4+ devices, even number)" />
                                <FormSelectOption value="raidz" label="RAID-Z (single parity, requires 3+ devices)" />
                                <FormSelectOption value="raidz2" label="RAID-Z2 (double parity, requires 4+ devices)" />
                                <FormSelectOption value="raidz3" label="RAID-Z3 (triple parity, requires 5+ devices)" />
                            </FormSelect>
                        </FormGroup>

                        <FormGroup
                            label={
                                <span>
                                    Sector Size (ashift)
                                    <Popover
                                        headerContent="About Sector Size (ashift)"
                                        bodyContent={
                                            <div style={{ fontSize: 'var(--pf-t--global--font--size--sm)' }}>
                                                <p style={{ marginBottom: 'var(--pf-t--global--spacer--sm)' }}>
                                                    The <strong>ashift</strong> property determines the physical block size of the pool. It is a power of 2.
                                                </p>
                                                <ul style={{ marginBottom: 'var(--pf-t--global--spacer--sm)', paddingLeft: 'var(--pf-t--global--spacer--md)' }}>
                                                    <li><strong>ashift=9</strong>: 512 bytes (Legacy drives)</li>
                                                    <li><strong>ashift=12</strong>: 4 KiB (Modern HDDs/SSDs)</li>
                                                    <li><strong>ashift=13</strong>: 8 KiB (Some high-end SSDs)</li>
                                                </ul>
                                                <p>
                                                    <strong>Why it matters:</strong> Using a value smaller than your drive's actual physical sector size will result in significantly reduced performance and increased wear.
                                                </p>
                                                <p style={{ marginTop: 'var(--pf-t--global--spacer--sm)' }}>
                                                    <strong>Recommendation:</strong> ashift=12 is the safest default for modern drives. This setting cannot be changed after pool creation.
                                                </p>
                                            </div>
                                        }
                                    >
                                        <button
                                            type="button"
                                            aria-label="More info for ashift"
                                            onClick={e => e.preventDefault()}
                                            style={{
                                                marginLeft: 'var(--pf-t--global--spacer--xs)',
                                                border: 'none',
                                                background: 'transparent',
                                                padding: 0,
                                                cursor: 'pointer',
                                                color: 'var(--pf-t--global--icon--color--subtle)'
                                            }}
                                        >
                                            <HelpIcon />
                                        </button>
                                    </Popover>
                                </span>
                            }
                            fieldId="pool-ashift"
                        >
                            <FormSelect
                                id="pool-ashift"
                                value={ashift}
                                onChange={(_, value) => setAshift(value)}
                            >
                                <FormSelectOption value="" label="Auto (System Default)" />
                                <FormSelectOption value="9" label="512 bytes (ashift=9)" />
                                <FormSelectOption value="12" label="4 KiB (ashift=12)" />
                                <FormSelectOption value="13" label="8 KiB (ashift=13)" />
                            </FormSelect>
                        </FormGroup>

                        <FormGroup
                            label="Select Devices"
                            fieldId="pool-devices"
                            validated={validationFailed.devices ? 'error' : 'default'}
                        >
                            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--pf-t--global--border--color--default)', borderRadius: 'var(--pf-t--global--border--radius--small)', padding: 'var(--pf-t--global--spacer--sm)' }}>
                                {availableDisks.length === 0 ? (
                                    <div style={{ padding: 'var(--pf-t--global--spacer--md)', textAlign: 'center', color: 'var(--pf-t--global--text--color--muted)' }}>
                                        No available disks found
                                    </div>
                                ) : (
                                    availableDisks.map(disk => (
                                        <Checkbox
                                            key={disk.path}
                                            id={`disk-${disk.path.replace(/\//g, '-')}`}
                                            label={
                                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                                    <span>
                                                        <strong>{disk.path}</strong>
                                                        {disk.name && disk.name !== disk.path.replace('/dev/', '') && (
                                                            <><br /><small>{disk.name}</small></>
                                                        )}
                                                    </span>
                                                    <span style={{ marginLeft: 'auto', color: 'var(--pf-t--global--text--color--muted)' }}>
                                                        {disk.size}
                                                    </span>
                                                </div>
                                            }
                                            isChecked={devices.includes(disk.path)}
                                            onChange={(_, checked) => {
                                                handleDeviceToggle(disk.path, checked);
                                                if (validationFailed.devices) {
                                                    setValidationFailed({ ...validationFailed, devices: undefined });
                                                }
                                            }}
                                        />
                                    ))
                                )}
                            </div>
                            <FormHelper
                                fieldId="pool-devices"
                                helperTextInvalid={validationFailed.devices}
                                helperText={
                                    vdevType === 'mirror' && devices.length > 0 && devices.length < 2
                                        ? 'Mirror requires at least 2 devices'
                                        : vdevType === 'raid10' && (devices.length < 4 || devices.length % 2 !== 0)
                                            ? 'RAID 10 requires at least 4 devices and an even number'
                                            : vdevType === 'raidz' && devices.length > 0 && devices.length < 3
                                            ? 'RAID-Z requires at least 3 devices'
                                            : vdevType === 'raidz2' && devices.length > 0 && devices.length < 4
                                                ? 'RAID-Z2 requires at least 4 devices'
                                                : vdevType === 'raidz3' && devices.length > 0 && devices.length < 5
                                                    ? 'RAID-Z3 requires at least 5 devices'
                                                    : undefined
                                }
                            />
                        </FormGroup>
                    </Form>
                )}
            </ModalBody>
            <ModalFooter>
                {showConfirm ? (
                    <>
                        <Button
                            variant="secondary"
                            isDanger
                            onClick={handleConfirmCreate}
                            isDisabled={confirmText.toLowerCase() !== 'yes' || creating}
                            isLoading={creating}
                        >
                            Create Pool
                        </Button>
                        <Button variant="secondary" onClick={() => setShowConfirm(false)} isDisabled={creating}>
                            Back
                        </Button>
                        <Button variant="link" onClick={onClose} isDisabled={creating}>
                            Cancel
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            variant="primary"
                            onClick={handleCreate}
                            isDisabled={loadingDisks}
                        >
                            Continue
                        </Button>
                        <Button variant="link" onClick={onClose}>
                            Cancel
                        </Button>
                    </>
                )}
            </ModalFooter>
        </Modal>
    );
}

export default CreatePoolDialog;

