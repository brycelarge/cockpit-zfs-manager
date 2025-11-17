import React from 'react';

import { Divider } from "@patternfly/react-core/dist/esm/components/Divider";
import { DropdownItem } from "@patternfly/react-core/dist/esm/components/Dropdown";
import { KebabDropdown } from 'cockpit-components-dropdown.jsx';

import { useDialogs } from 'dialogs.jsx';
import CloneFileSystemDialog from './cloneFileSystemDialog.jsx';
import DeleteFileSystemDialog from './deleteFileSystemDialog.jsx';
import CreateSnapshotDialog from './createSnapshotDialog.jsx';

function FileSystemActions({ filesystem, pool, onRefresh }) {
    const Dialogs = useDialogs();

    const dropdownItems = [
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
        <Divider key={`${filesystem.name}-separator`} />,
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

