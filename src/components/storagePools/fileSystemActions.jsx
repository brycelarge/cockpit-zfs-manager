import React from 'react';

import { Divider } from "@patternfly/react-core/dist/esm/components/Divider";
import { DropdownItem } from "@patternfly/react-core/dist/esm/components/Dropdown";
import { KebabDropdown } from 'cockpit-components-dropdown.jsx';

import { useDialogs } from 'dialogs.jsx';
import CloneFileSystemDialog from './cloneFileSystemDialog.jsx';
import ReplicateFileSystemDialog from './replicateFileSystemDialog.jsx';
import DeleteFileSystemDialog from './deleteFileSystemDialog.jsx';
import CreateSnapshotDialog from './createSnapshotDialog.jsx';
import DatasetPropertiesDialog from './datasetPropertiesDialog.jsx';
import MountPointDialog from './mountPointDialog.jsx';
import SharesDialog from './sharesDialog.jsx';
import RenameDatasetDialog from './renameDatasetDialog.jsx';

function FileSystemActions({ filesystem, pool, pools, onRefresh }) {
    const Dialogs = useDialogs();

    const dropdownItems = [
        <DropdownItem
            key={`${filesystem.name}-properties`}
            id={`${filesystem.name}-properties`}
            onClick={() => Dialogs.show(<DatasetPropertiesDialog filesystem={filesystem} onRefresh={onRefresh} />)}
        >
            Properties
        </DropdownItem>,
        <DropdownItem
            key={`${filesystem.name}-mount`}
            id={`${filesystem.name}-mount`}
            onClick={() => Dialogs.show(<MountPointDialog filesystem={filesystem} onRefresh={onRefresh} />)}
        >
            Mount Point
        </DropdownItem>,
        <DropdownItem
            key={`${filesystem.name}-shares`}
            id={`${filesystem.name}-shares`}
            onClick={() => Dialogs.show(<SharesDialog filesystem={filesystem} onRefresh={onRefresh} />)}
        >
            Shares (NFS/SMB)
        </DropdownItem>,
        <Divider key={`${filesystem.name}-separator-1`} />,
        <DropdownItem
            key={`${filesystem.name}-snapshot`}
            id={`${filesystem.name}-snapshot`}
            onClick={() => Dialogs.show(<CreateSnapshotDialog pool={pool} filesystem={filesystem} onRefresh={onRefresh} />)}
        >
            Create Snapshot
        </DropdownItem>,
        <DropdownItem
            key={`${filesystem.name}-clone`}
            id={`${filesystem.name}-clone`}
            onClick={() => Dialogs.show(<CloneFileSystemDialog filesystem={filesystem} pool={pool} onRefresh={onRefresh} />)}
        >
            Clone
        </DropdownItem>,
        <DropdownItem
            key={`${filesystem.name}-replicate`}
            id={`${filesystem.name}-replicate`}
            onClick={() => Dialogs.show(<ReplicateFileSystemDialog filesystem={filesystem} pool={pool} pools={pools} onRefresh={onRefresh} />)}
        >
            Replicate
        </DropdownItem>,
        <DropdownItem
            key={`${filesystem.name}-rename`}
            id={`${filesystem.name}-rename`}
            onClick={() => Dialogs.show(<RenameDatasetDialog dataset={filesystem} pool={pool} onRefresh={onRefresh} />)}
        >
            Rename
        </DropdownItem>,
        <Divider key={`${filesystem.name}-separator-2`} />,
        <DropdownItem
            key={`${filesystem.name}-delete`}
            id={`${filesystem.name}-delete`}
            className="pf-m-danger"
            onClick={() => Dialogs.show(<DeleteFileSystemDialog filesystem={filesystem} pool={pool} onRefresh={onRefresh} />)}
        >
            Delete
        </DropdownItem>
    ];

    return (
        <div className="btn-group">
            <KebabDropdown
                toggleButtonId={`${filesystem.name}-action-kebab`}
                position="right"
                dropdownItems={dropdownItems}
            />
        </div>
    );
}

export default FileSystemActions;

