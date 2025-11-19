import React, { useState, useEffect } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';

function UpgradeAllPoolsDialog({ pools, onRefresh }) {
    const Dialogs = useDialogs();
    const [loading, setLoading] = useState(true);
    const [upgrading, setUpgrading] = useState(false);
    const [poolVersions, setPoolVersions] = useState([]);
    const [availableVersions, setAvailableVersions] = useState([]);
    const [error, setError] = useState({});
    const [confirmIrreversible, setConfirmIrreversible] = useState(false);

    useEffect(() => {
        loadVersionInfo();
    }, [pools]);

    const loadVersionInfo = async () => {
        setLoading(true);
        setError({});
        try {
            const versions = await ZfsApi.getAvailableUpgradeVersions();
            setAvailableVersions(versions);
            
            // Get versions for all pools
            const versionPromises = pools.map(async (pool) => {
                try {
                    const version = await ZfsApi.getPoolVersion(pool.name);
                    return { pool: pool.name, version, canUpgrade: false };
                } catch {
                    return { pool: pool.name, version: null, canUpgrade: false };
                }
            });
            
            const versionsData = await Promise.all(versionPromises);
            const maxVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version)) : null;
            
            const poolsWithUpgrade = versionsData.map(p => ({
                ...p,
                canUpgrade: maxVersion && p.version !== null && maxVersion > p.version
            }));
            
            setPoolVersions(poolsWithUpgrade);
        } catch (exc) {
            setError({
                dialogError: 'Failed to load version information',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setLoading(false);
        }
    };

    const handleUpgradeAll = async () => {
        if (!confirmIrreversible) {
            setError({
                dialogError: 'Confirmation required',
                dialogErrorDetail: 'Please confirm that you understand this upgrade is irreversible'
            });
            return;
        }

        setUpgrading(true);
        setError({});
        try {
            await ZfsApi.upgradeAllPools();
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: 'Failed to upgrade all pools',
                dialogErrorDetail: exc.message || String(exc)
            });
            setUpgrading(false);
        }
    };

    const upgradablePools = poolVersions.filter(p => p.canUpgrade);
    const canUpgrade = upgradablePools.length > 0;

    if (loading) {
        return (
            <Modal position="top" variant="medium" isOpen onClose={Dialogs.close}>
                <ModalBody>
                    <Spinner size="lg" aria-label="Loading version information" />
                </ModalBody>
            </Modal>
        );
    }

    return (
        <Modal position="top" variant="large" isOpen onClose={Dialogs.close}>
            <ModalHeader title="Upgrade All Pools" />
            <ModalBody>
                {error.dialogError && (
                    <ModalError
                        dialogError={error.dialogError}
                        {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                    />
                )}

                <Alert variant="warning" title="Irreversible Operation" style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <p>
                        Pool upgrades are <strong>irreversible</strong>. Once upgraded, pools cannot be downgraded to previous versions.
                        Older ZFS systems may not be able to import pools with newer versions.
                    </p>
                </Alert>

                {canUpgrade ? (
                    <>
                        <p style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                            The following {upgradablePools.length} pool(s) will be upgraded:
                        </p>
                        <ul style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                            {upgradablePools.map(p => (
                                <li key={p.pool}>
                                    <strong>{p.pool}</strong> (Current: Version {p.version})
                                </li>
                            ))}
                        </ul>
                    </>
                ) : (
                    <Alert variant="info" title="All pools are up to date">
                        <p>
                            All pools are already at the latest version supported by your ZFS software.
                        </p>
                    </Alert>
                )}

                {canUpgrade && (
                    <Checkbox
                        id="confirm-irreversible-all"
                        label="I understand this upgrade is irreversible and may affect compatibility with older ZFS systems"
                        isChecked={confirmIrreversible}
                        onChange={(_, checked) => {
                            setConfirmIrreversible(checked);
                            if (error.dialogError) {
                                setError({});
                            }
                        }}
                    />
                )}
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    id="upgrade-all-pools-dialog-confirm"
                    onClick={handleUpgradeAll}
                    isDisabled={!canUpgrade || !confirmIrreversible || upgrading}
                    isLoading={upgrading}
                >
                    Upgrade All Pools
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={upgrading}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default UpgradeAllPoolsDialog;

