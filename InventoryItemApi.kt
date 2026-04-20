package com.project.fridgemate.data.remote.api

import com.project.fridgemate.data.remote.dto.InventoryItemDto
import com.project.fridgemate.data.remote.dto.PaginatedResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path

interface InventoryItemApi {

    @GET("fridges/{fridgeId}/items")
    suspend fun getItems(
        @Path("fridgeId") fridgeId: String
    ): Response<PaginatedResponse<InventoryItemDto>>
}
