package com.project.fridgemate.data.repository

import android.content.Context
import com.project.fridgemate.data.local.AppDatabase
import com.project.fridgemate.data.local.entity.InventoryItemEntity
import com.project.fridgemate.data.remote.ApiClient
import com.project.fridgemate.data.remote.api.InventoryItemApi
import com.project.fridgemate.data.remote.dto.InventoryItemDto

class InventoryItemRepository(context: Context) {

    private val api = ApiClient.createApi(InventoryItemApi::class.java)
    private val dao = AppDatabase.getInstance(context).inventoryItemDao()

    suspend fun getCachedItems(): List<InventoryItemDto> {
        return dao.getAll().map { it.toDto() }
    }

    suspend fun getItems(fridgeId: String): List<InventoryItemDto> {
        return try {
            val response = api.getItems(fridgeId)
            if (response.isSuccessful) {
                val items = response.body()?.items ?: emptyList()
                cacheItems(items)
                items
            } else emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun clearCache() {
        try { dao.deleteAll() } catch (_: Exception) { }
    }

    private suspend fun cacheItems(items: List<InventoryItemDto>) {
        try {
            dao.deleteAll()
            dao.insertAll(items.map { it.toEntity() })
        } catch (_: Exception) { }
    }

    private fun InventoryItemDto.toEntity() = InventoryItemEntity(
        id = id,
        fridgeId = fridgeId,
        ownerId = ownerId,
        name = name,
        quantity = quantity,
        ownership = ownership,
        isRunningLow = isRunningLow
    )

    private fun InventoryItemEntity.toDto() = InventoryItemDto(
        id = id,
        fridgeId = fridgeId,
        ownerId = ownerId,
        name = name,
        quantity = quantity,
        ownership = ownership,
        isRunningLow = isRunningLow
    )
}
