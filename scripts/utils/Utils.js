export const ORIGIN_FOLDER = "data";
export const randomString = () =>
    Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
export const userCanUpload = (silent = false) => {
    const userRole = game?.user?.role;
    const fileUploadPermissions = game?.permissions?.FILES_UPLOAD;

    if (!userRole || !fileUploadPermissions) {
        if (!silent) ui.notifications?.warn("You don't have upload privileges");
        return false;
    }

    const uploadPermission = fileUploadPermissions.includes(userRole);
    if (!uploadPermission && !silent) ui.notifications?.warn("You don't have upload privileges");

    return uploadPermission;
};
