package testcase

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/service/auth"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type Handler struct {
	usecase     Usecase
	authHandler *auth.Handler
}

func NewHandler(u Usecase, authHandler *auth.Handler) *Handler {
	return &Handler{
		usecase:     u,
		authHandler: authHandler,
	}
}

func (h *Handler) GetTestCases(c echo.Context) error {
	_, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	testCases, err := h.usecase.GetTestCases(c.Request().Context(), projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, testCases)
}

func (h *Handler) CreateTestCase(c echo.Context) error {
	_, userID, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	req := new(models.TestCase)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	tc, err := h.usecase.CreateTestCase(c.Request().Context(), projectID, userID, *req)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, tc)
}

func (h *Handler) UpdateTestCase(c echo.Context) error {
	_, userID, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}
	tcID, err := uuid.Parse(c.Param("tc_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid test case ID")
	}

	req := new(models.TestCase)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	tc, err := h.usecase.UpdateTestCase(c.Request().Context(), tcID, projectID, userID, *req)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "Test case not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, tc)
}

func (h *Handler) DeleteTestCase(c echo.Context) error {
	_, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}
	tcID, err := uuid.Parse(c.Param("tc_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid test case ID")
	}

	err = h.usecase.DeleteTestCase(c.Request().Context(), tcID, projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}
