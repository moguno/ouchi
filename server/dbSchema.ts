import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { projectColorFromName } from "../src/portal/colorValue";

export type DbOptions = {
  filename?: string;
  schemaPath?: string;
  seedPath?: string;
  devicePetnameMigrationPath?: string;
  relationNamesMigrationPath?: string;
  relationPlaceholdersMigrationPath?: string;
  relationLabelsMigrationPath?: string;
  interfacesMigrationPath?: string;
  interfaceMacMigrationPath?: string;
  interfaceDropLabelMigrationPath?: string;
  networkAccentMigrationPath?: string;
  deviceDropIsVmMigrationPath?: string;
  relationNameLineEndsMigrationPath?: string;
  serviceIconChoicesMigrationPath?: string;
  relationPropertiesMigrationPath?: string;
  networkSettingsPropertiesMigrationPath?: string;
  networkSortOrderMigrationPath?: string;
  relationServiceEndpointsMigrationPath?: string;
  relationPortMigrationPath?: string;
  projectsMigrationPath?: string;
  interfacePropertiesMigrationPath?: string;
  projectOuchiMigrationPath?: string;
  projectColorMigrationPath?: string;
  metaMigrationPath?: string;
};

export function applySchemaAndMigrations(
  database: DatabaseSync,
  options: DbOptions,
): void {
  const root = process.cwd();
      const schemaPath =
        options.schemaPath ?? resolve(root, "contract-v1", "schema.sql");
      const seedPath =
        options.seedPath ?? resolve(root, "contract-v1", "seed.sql");
      database.exec(readFileSync(schemaPath, "utf8"));
      const devicePetnameMigrationPath =
        options.devicePetnameMigrationPath ??
        resolve(
          root,
          "contract-v1",
          "migrations",
          "001_add_device_petname.sql",
        );
      const deviceColumns = database
        .prepare("PRAGMA table_info(devices)")
        .all() as Array<{ name: string }>;
      if (!deviceColumns.some((column) => column.name === "petname")) {
        database.exec(readFileSync(devicePetnameMigrationPath, "utf8"));
      }
      const ensureColumn = (
        table: "devices" | "services",
        column: "properties",
        migrationFile: string,
      ) => {
        const columns = database
          .prepare(`PRAGMA table_info(${table})`)
          .all() as Array<{ name: string }>;
        if (!columns.some((item) => item.name === column)) {
          database.exec(
            readFileSync(
              resolve(root, "contract-v1", "migrations", migrationFile),
              "utf8",
            ),
          );
        }
      };
      ensureColumn("devices", "properties", "002_add_device_properties.sql");
      ensureColumn("services", "properties", "003_add_service_properties.sql");
      let relationColumns = database
        .prepare("PRAGMA table_info(relations)")
        .all() as Array<{ name: string }>;
      if (relationColumns.some((column) => column.name === "tag")) {
        const relationNamesMigrationPath =
          options.relationNamesMigrationPath ??
          resolve(
            root,
            "contract-v1",
            "migrations",
            "004_relation_names.sql",
          );
        database.exec(readFileSync(relationNamesMigrationPath, "utf8"));
        relationColumns = database
          .prepare("PRAGMA table_info(relations)")
          .all() as Array<{ name: string }>;
      }
      if (
        (!relationColumns.some(
          (column) => column.name === "from_placeholder",
        ) ||
          !relationColumns.some(
            (column) => column.name === "to_placeholder",
          )) &&
        // Databases born from the current schema already carry the label
        // columns that supersede placeholders; they must skip this step.
        !relationColumns.some((column) => column.name === "from_label")
      ) {
        const relationPlaceholdersMigrationPath =
          options.relationPlaceholdersMigrationPath ??
          resolve(
            root,
            "contract-v1",
            "migrations",
            "005_relation_placeholders.sql",
          );
        database.exec(
          readFileSync(relationPlaceholdersMigrationPath, "utf8"),
        );
        relationColumns = database
          .prepare("PRAGMA table_info(relations)")
          .all() as Array<{ name: string }>;
      }
      const relationNameColumns = database
        .prepare("PRAGMA table_info(relation_names)")
        .all() as Array<{ name: string }>;
      if (
        relationColumns.some(
          (column) => column.name === "from_placeholder",
        ) ||
        relationNameColumns.some((column) => column.name === "from_label")
      ) {
        const relationLabelsMigrationPath =
          options.relationLabelsMigrationPath ??
          resolve(
            root,
            "contract-v1",
            "migrations",
            "006_relation_labels.sql",
          );
        database.exec(
          readFileSync(relationLabelsMigrationPath, "utf8"),
        );
      }

      const legacyMembershipTable = database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'device_networks'",
        )
        .get() as { name: string } | undefined;
      if (legacyMembershipTable) {
        const interfacesMigrationPath =
          options.interfacesMigrationPath ??
          resolve(
            root,
            "contract-v1",
            "migrations",
            "007_interfaces.sql",
          );
        database.exec(readFileSync(interfacesMigrationPath, "utf8"));
      }

      const interfaceColumns = database
        .prepare("PRAGMA table_info(interfaces)")
        .all() as Array<{ name: string }>;
      if (!interfaceColumns.some((column) => column.name === "mac")) {
        const interfaceMacMigrationPath =
          options.interfaceMacMigrationPath ??
          resolve(
            root,
            "contract-v1",
            "migrations",
            "008_interface_mac.sql",
          );
        database.exec(readFileSync(interfaceMacMigrationPath, "utf8"));
      }

      const interfaceColumnsAfterMac = database
        .prepare("PRAGMA table_info(interfaces)")
        .all() as Array<{ name: string }>;
      if (interfaceColumnsAfterMac.some((column) => column.name === "label")) {
        const interfaceDropLabelMigrationPath =
          options.interfaceDropLabelMigrationPath ??
          resolve(
            root,
            "contract-v1",
            "migrations",
            "009_interface_drop_label.sql",
          );
        database.exec(
          readFileSync(interfaceDropLabelMigrationPath, "utf8"),
        );
      }

      const legacyAccent = database
        .prepare(
          "SELECT COUNT(*) AS count FROM networks WHERE accent IN ('blue', 'green', 'orange', 'violet', 'slate')",
        )
        .get() as { count: number };
      if (legacyAccent.count > 0) {
        const networkAccentMigrationPath =
          options.networkAccentMigrationPath ??
          resolve(
            root,
            "contract-v1",
            "migrations",
            "010_network_accent_color.sql",
          );
        database.exec(readFileSync(networkAccentMigrationPath, "utf8"));
      }

      const deviceColumnsCurrent = database
        .prepare("PRAGMA table_info(devices)")
        .all() as Array<{ name: string }>;
      if (deviceColumnsCurrent.some((column) => column.name === "is_vm")) {
        const deviceDropIsVmMigrationPath =
          options.deviceDropIsVmMigrationPath ??
          resolve(
            root,
            "contract-v1",
            "migrations",
            "011_device_drop_is_vm.sql",
          );
        database.exec(readFileSync(deviceDropIsVmMigrationPath, "utf8"));
      }

      const relationNameColumnsCurrent = database
        .prepare("PRAGMA table_info(relation_names)")
        .all() as Array<{ name: string }>;
      if (
        !relationNameColumnsCurrent.some(
          (column) => column.name === "line_start",
        )
      ) {
        const relationNameLineEndsMigrationPath =
          options.relationNameLineEndsMigrationPath ??
          resolve(
            root,
            "contract-v1",
            "migrations",
            "012_relation_name_line_ends.sql",
          );
        database.exec(
          readFileSync(relationNameLineEndsMigrationPath, "utf8"),
        );
      }

      const legacyIconRow = database
        .prepare(
          `SELECT COUNT(*) AS count FROM services
           WHERE icon_key LIKE 'generic:%'
             OR icon_key LIKE 'preset:%'
             OR icon_key LIKE 'dashboard:%'
             OR icon_key = ''
             OR (icon_key NOT LIKE '%:%' AND icon_key <> 'favicon')`,
        )
        .get() as { count: number };
      if (legacyIconRow.count > 0) {
        const serviceIconChoicesMigrationPath =
          options.serviceIconChoicesMigrationPath ??
          resolve(
            root,
            "contract-v1",
            "migrations",
            "013_service_icon_choices.sql",
          );
        database.exec(
          readFileSync(serviceIconChoicesMigrationPath, "utf8"),
        );
      }

      const relationColumnsCurrent = database
        .prepare("PRAGMA table_info(relations)")
        .all() as Array<{ name: string }>;
      if (
        !relationColumnsCurrent.some((column) => column.name === "properties")
      ) {
        const relationPropertiesMigrationPath =
          options.relationPropertiesMigrationPath ??
          resolve(
            root,
            "contract-v1",
            "migrations",
            "014_relation_properties.sql",
          );
        database.exec(
          readFileSync(relationPropertiesMigrationPath, "utf8"),
        );
      }

      const networkColumnsCurrent = database
        .prepare("PRAGMA table_info(networks)")
        .all() as Array<{ name: string }>;
      if (
        !networkColumnsCurrent.some((column) => column.name === "properties")
      ) {
        const networkSettingsPropertiesMigrationPath =
          options.networkSettingsPropertiesMigrationPath ??
          resolve(
            root,
            "contract-v1",
            "migrations",
            "015_network_settings_properties.sql",
          );
        database.exec(
          readFileSync(networkSettingsPropertiesMigrationPath, "utf8"),
        );
      }
      if (
        !networkColumnsCurrent.some((column) => column.name === "sort_order")
      ) {
        const networkSortOrderMigrationPath =
          options.networkSortOrderMigrationPath ??
          resolve(
            root,
            "contract-v1",
            "migrations",
            "016_network_sort_order.sql",
          );
        database.exec(
          readFileSync(networkSortOrderMigrationPath, "utf8"),
        );
      }
      const relationColumnsFor017 = database
        .prepare("PRAGMA table_info(relations)")
        .all() as Array<{ name: string }>;
      if (
        !relationColumnsFor017.some(
          (column) => column.name === "from_service_id",
        )
      ) {
        const relationServiceEndpointsMigrationPath =
          options.relationServiceEndpointsMigrationPath ??
          resolve(
            root,
            "contract-v1",
            "migrations",
            "017_relation_service_endpoints.sql",
          );
        database.exec(
          readFileSync(relationServiceEndpointsMigrationPath, "utf8"),
        );
      }
      const relationColumnsFor018 = database
        .prepare("PRAGMA table_info(relations)")
        .all() as Array<{ name: string }>;
      if (
        !relationColumnsFor018.some((column) => column.name === "port")
      ) {
        const relationPortMigrationPath =
          options.relationPortMigrationPath ??
          resolve(
            root,
            "contract-v1",
            "migrations",
            "018_relation_port.sql",
          );
        database.exec(readFileSync(relationPortMigrationPath, "utf8"));
      }

      const projectsTable = database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'projects'",
        )
        .get() as { name: string } | undefined;
      if (!projectsTable) {
        const projectsMigrationPath =
          options.projectsMigrationPath ??
          resolve(
            root,
            "contract-v1",
            "migrations",
            "019_projects.sql",
          );
        database.exec(readFileSync(projectsMigrationPath, "utf8"));
      }

      const interfaceColumnsCurrent = database
        .prepare("PRAGMA table_info(interfaces)")
        .all() as Array<{ name: string }>;
      if (
        !interfaceColumnsCurrent.some((column) => column.name === "properties")
      ) {
        const interfacePropertiesMigrationPath =
          options.interfacePropertiesMigrationPath ??
          resolve(
            root,
            "contract-v1",
            "migrations",
            "020_interface_properties.sql",
          );
        database.exec(
          readFileSync(interfacePropertiesMigrationPath, "utf8"),
        );
      }

      const projectColumnsCurrent = database
        .prepare("PRAGMA table_info(projects)")
        .all() as Array<{ name: string }>;
      if (
        !projectColumnsCurrent.some((column) => column.name === "title")
      ) {
        const projectOuchiMigrationPath =
          options.projectOuchiMigrationPath ??
          resolve(
            root,
            "contract-v1",
            "migrations",
            "021_project_ouchi.sql",
          );
        database.exec(readFileSync(projectOuchiMigrationPath, "utf8"));
      }

      const projectColumnsWithColor = database
        .prepare("PRAGMA table_info(projects)")
        .all() as Array<{ name: string }>;
      if (
        !projectColumnsWithColor.some((column) => column.name === "color")
      ) {
        const projectColorMigrationPath =
          options.projectColorMigrationPath ??
          resolve(
            root,
            "contract-v1",
            "migrations",
            "022_project_color.sql",
          );
        database.exec(readFileSync(projectColorMigrationPath, "utf8"));
      }
      // Backfill: a project's color is decided at creation from its
      // name. Rows that predate the column (or a seed) carry the
      // empty default and receive the same derivation here.
      const colorlessProjects = database
        .prepare("SELECT id, name FROM projects WHERE color = ''")
        .all() as Array<{ id: number; name: string }>;
      const backfillColor = database.prepare(
        "UPDATE projects SET color = ? WHERE id = ?",
      );
      for (const project of colorlessProjects) {
        backfillColor.run(projectColorFromName(project.name), project.id);
      }

      const metaTable = database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'meta'",
        )
        .get() as { name: string } | undefined;
      if (!metaTable) {
        const metaMigrationPath =
          options.metaMigrationPath ??
          resolve(root, "contract-v1", "migrations", "023_meta.sql");
        database.exec(readFileSync(metaMigrationPath, "utf8"));
      }

      // The seed is a first-run convenience only. Once a ledger has
      // been seeded (or populated), the 'seeded' marker keeps it from
      // ever coming back — even when the user deletes every project
      // and network on purpose.
      const seeded = database
        .prepare("SELECT value FROM meta WHERE key = 'seeded'")
        .get() as { value: string } | undefined;
      const row = database
        .prepare("SELECT COUNT(*) AS count FROM networks")
        .get() as { count: number };
      if (row.count === 0 && !seeded) {
        database.exec(readFileSync(seedPath, "utf8"));
        database
          .prepare(
            "INSERT OR IGNORE INTO meta (key, value) VALUES ('seeded', '1')",
          )
          .run();
      } else if (row.count > 0 && !seeded) {
        database
          .prepare(
            "INSERT OR IGNORE INTO meta (key, value) VALUES ('seeded', '1')",
          )
          .run();
      }
}
