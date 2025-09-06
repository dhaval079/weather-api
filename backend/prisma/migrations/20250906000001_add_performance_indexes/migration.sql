-- CreateIndex
CREATE INDEX `Property_city_state_idx` ON `Property`(`city`, `state`);

-- CreateIndex
CREATE INDEX `Property_isActive_geohash5_idx` ON `Property`(`isActive`, `geohash5`);

-- CreateIndex
CREATE INDEX `Property_isActive_city_state_idx` ON `Property`(`isActive`, `city`, `state`);

-- CreateIndex
CREATE INDEX `Property_createdAt_idx` ON `Property`(`createdAt`);

-- CreateFullTextIndex
CREATE FULLTEXT INDEX `Property_name_idx` ON `Property`(`name`);